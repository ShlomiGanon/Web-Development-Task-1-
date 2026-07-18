// Profile browsing page: content grid, details, playback, reviews, and last-watched.

import { Profile, ContentItem } from './api/models.js';
import { Backend } from './constants.js';
import { ClientSessionManager } from './core/session.js';
import
{
    escapeHtml, renderContentCard, renderLikeButton, renderField,
    formatReleaseDate, formatCategories, formatRating,
    coverUrl, profileImageUrl, renderNavbar, renderEmptyState,
    isOk, goToLink, lockUi, showErrorMessage, withUiLock
} from './ui.js';

//=============== DOM setup and module state ===============

const token = ClientSessionManager.getSessionToken();
const activeProfileId = ClientSessionManager.getActiveProfileId();

// How often to report playback position while a video plays; also sent on pause.
const PROGRESS_UPDATE_INTERVAL_SECONDS = 10;
const BACK_TO_DETAILS_CONTAINER_ID = 'back_to_details_container';

// IDs of the two persistent sub-containers we build inside lastWatchedContainer whenever it's
// showing a single content item (as opposed to the "My List" grid). content_main_area swaps
// between the full details view and the video player; episode_picker_area (season tabs +
// episode list) is never touched by that swap, so it stays visible in both states.
const CONTENT_MAIN_AREA_ID = 'content_main_area';
const EPISODE_PICKER_AREA_ID = 'episode_picker_area';

// Inject the navbar first so the right-side controls (search/profile) and nav links resolve.
renderNavbar(document.getElementById('navbar_root'), {
    brand: { href: '#', imgSrc: '/assets/netflix_logo.png', width: 60 },
    items: [
        { id: 'home_link', label: 'Home', href: '#all_content_container', onClick: () => withUiLock(null, handleHomeLinkClick) },
        { id: 'tv_shows_link', label: 'TV Shows', href: '#all_content_container', onClick: () => withUiLock(null, handleTvShowsLinkClick) },
        { id: 'movies_link', label: 'Movies', href: '#all_content_container', onClick: () => withUiLock(null, handleMoviesLinkClick) },
        { id: 'games_link', label: 'Games', href: '#all_content_container', onClick: () => handleGamesLinkClick() },
        { id: 'new_and_popular_link', label: 'New & Popular', href: '#all_content_container', onClick: () => withUiLock(null, handleNewAndPopularLinkClick) },
        { id: 'my_list_link', label: 'My List', href: '#last_watched_container', onClick: () => handleMyListLinkClick() },
    ],
    rightHtml: `
        <input id="search_input" class="input p-1 me-2 border-0">
        <button id="search_button" class="btn btn-link p-0 me-2"><img src="/assets/icon1.png" width="18"></button>
        <img id="profile_image" src="/assets/profiles_images/ERROR.png" width="25" class="me-2">
        <a href="/html/profiles.html" class="nav-link me-3"><img src="/assets/down_arrow.png" width="12"></a>
    `
});

let activeContentItem = null;
let activeProfile = null;
let userSearchQuery = '';

// filteredContentItems = current grid subset (per nav click/search); allContentItems = full
// catalog fetched once, used for lookups so a watched item never disappears from the grid.
let filteredContentItems = null;
let allContentItems = null;

// What's drawn in the details container now ('details' or 'my_list') so like toggles redraw it.
let currentLastWatchedView = null;

// Episode picker state - only relevant while viewing a series item's details.
let currentSeriesContentId = null;
let currentSeriesSeasons = null; // seasons[0] = season 1, etc.
let currentSelectedSeason = 1;

// Currently playing content/episode; also the details/player flag (set -> player showing).
let currentWatchingContentId = null;
let currentWatchingEpisodeId = null;

// Periodic progress-reporting timer; restarted per episode so only one ever runs.
let progressUpdateIntervalId = null;

const lastWatchedContainer = document.getElementById('last_watched_container');
const lastWatchedHeading = document.getElementById('last_watched_text');
const contentGridContainer = document.getElementById('all_content_container');
const contentGridHeading = document.getElementById('all_content_text');
const searchButton = document.getElementById('search_button');
const searchInput = document.getElementById('search_input');
const profileImage = document.getElementById('profile_image');
const videoElement = document.getElementById('screen_video');
const videoPlayerSection = document.getElementById('video_player_section');
const reviewFormContainer = document.getElementById('review_form_container');
const reviewsListContainer = document.getElementById('reviews_list_container');
const reviewsSection = document.getElementById('reviews_section');

// Reviews still sit in their own section right after the details/player area. The video
// player itself is no longer positioned here - it gets moved (as a live DOM node, so its
// element identity/listeners survive) into content_main_area whenever playback starts.
lastWatchedContainer.insertAdjacentElement('afterend', reviewsSection);
videoPlayerSection.classList.add('d-none');
reviewsSection.classList.add('d-none');

//=============== Content details rendering ===============

// Rebuilds lastWatchedContainer with two persistent sub-areas: content_main_area (swaps
// between full details and the video player) and episode_picker_area (season tabs + episode
// list, left untouched by that swap so it stays visible whether details or the player is
// showing). Called whenever a *new* content item's details are opened - episodes are
// refetched fresh, matching the previous behavior.
function ensureContentViewSkeleton()
{
    lastWatchedContainer.innerHTML = `
        <div id="${CONTENT_MAIN_AREA_ID}" class="w-100"></div>
        <div id="${EPISODE_PICKER_AREA_ID}" class="w-100"></div>
    `;
    return document.getElementById(CONTENT_MAIN_AREA_ID);
}

async function renderContentDetails(contentItem)
{
    const response = await Backend.getContentByID(contentItem.id);
    if (!isOk(response, "get content item")) return;

    contentItem = ContentItem.fromJSON(response.content);

    lastWatchedContainer.classList.remove('d-none');
    lastWatchedHeading.textContent = escapeHtml(contentItem.title);
    const contentMainArea = ensureContentViewSkeleton();

    const typeLabel = contentItem.type === 'series' ? 'Series' : 'Movie';
    const categoriesLabel = formatCategories(contentItem.categories);
    const releaseDateLabel = formatReleaseDate(contentItem.release_date);

    const isLiked = activeProfile ? activeProfile.likedContentIds.has(contentItem.id) : false;
    const likeButtonHtml = renderLikeButton({
        contentId: contentItem.id,
        likes: contentItem.likes,
        isLiked,
        showLabel: false,
        extraClasses: 'fs-6',
        type: 'button'
    });

    const badges = [
        `<span class="badge bg-danger fs-6">${escapeHtml(typeLabel)}</span>`,
        `<span class="badge bg-secondary fs-6">Age ${escapeHtml(contentItem.age_limit)}+</span>`,
        likeButtonHtml,
    ];
    if (contentItem.imdb_rating !== null && contentItem.imdb_rating !== undefined)
    {
        badges.push(`<span class="badge bg-warning text-dark fs-6">⭐ IMDB ${escapeHtml(contentItem.imdb_rating)}</span>`);
    }
    if (contentItem.review_count > 0)
    {
        badges.push(`<span class="badge bg-primary fs-6">★ ${escapeHtml(formatRating(contentItem.average_rating))} (${escapeHtml(contentItem.review_count)} reviews)</span>`);
    }

    // Shown only if this profile already has watch history for this content; resumes playback.
    const hasWatchHistory = activeProfile ? activeProfile.lastWatched.some(entry => entry.content_id === contentItem.id) : false;
    const resumeButtonHtml = hasWatchHistory
        ? `<button type="button" class="btn btn-danger btn-lg" data-action="resume" data-content-id="${escapeHtml(contentItem.id)}">▶ Resume Watching</button>`
        : '';

    const contentHtml = `
    <div class="w-100 p-4" dir="ltr">
        <div class="row g-4 align-items-start">
            <div class="col-12 col-md-4 text-center">
                <img src="${coverUrl(escapeHtml(contentItem.cover_image_name))}"
                     class="img-fluid rounded shadow"
                     style="max-height: 450px; width: 100%; object-fit: cover;"
                     alt="${escapeHtml(contentItem.title)}">
            </div>
            <div class="col-12 col-md-8">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h1 class="fw-bold text-white m-0">${escapeHtml(contentItem.title)}</h1>
                    ${resumeButtonHtml}
                </div>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    ${badges.join('\n                    ')}
                </div>
                <p class="text-light fs-5" style="white-space: pre-wrap;">${escapeHtml(contentItem.description) || 'No description available'}</p>
                <div class="mt-3">
                    ${renderField('Categories', escapeHtml(categoriesLabel))}
                    ${renderField('Release Date', escapeHtml(releaseDateLabel))}
                </div>
            </div>
        </div>
    </div>
    `;
    contentMainArea.innerHTML = contentHtml;

    // Series get an episode picker; movies get a single play button.
    if (contentItem.type === "series")
    {
        await renderEpisodePicker(contentItem.id);
    }
    else if (contentItem.type === "movie")
    {
        currentSeriesContentId = null;
        currentSeriesSeasons = null;
        renderMoviePlayButton(contentItem.id);
    }
    else
    {
        currentSeriesContentId = null;
        currentSeriesSeasons = null;
    }
}

function renderMoviePlayButton(contentId)
{
    const contentMainArea = document.getElementById(CONTENT_MAIN_AREA_ID);
    if (!contentMainArea) return;

    const playButtonHtml = `
        <div class="w-100 p-4 text-center" dir="ltr">
            <button type="button" class="btn btn-danger btn-lg" data-action="play-movie" data-content-id="${escapeHtml(contentId)}">
                ▶ Play Movie
            </button>
        </div>
    `;
    contentMainArea.insertAdjacentHTML('beforeend', playButtonHtml);
}

//=============== Playback: start/resume, episode navigation, progress ===============

// Cold-start guard: playback can be triggered (via the pinned "Continue Watching" button)
// before any content's details have been opened this session, in which case content_main_area
// / episode_picker_area don't exist yet. Builds them (and sets activeContentItem) first so the
// video always has a details view underneath it to swap with and return to.
async function ensureDetailsViewForPlayback(contentId)
{
    const skeletonReady = document.getElementById(CONTENT_MAIN_AREA_ID) && activeContentItem && activeContentItem.id === contentId;
    if (skeletonReady) return;

    if (currentWatchingContentId && currentWatchingContentId !== contentId)
    {
        await stopPlayback();
    }

    const item = (allContentItems && allContentItems.find(content => content.id === contentId))
        ?? (filteredContentItems && filteredContentItems.find(content => content.id === contentId));
    if (!item)
    {
        console.error("Failed to find content for playback");
        return;
    }

    activeContentItem = item;
    currentLastWatchedView = 'details';
    await renderContentDetails(item);
}

// Resumes saved progress if any, otherwise starts at S1E1.
async function startOrResumeContentPlayback(contentId)
{
    await ensureDetailsViewForPlayback(contentId);

    const response = await Backend.selectContentItem(token, activeProfileId, contentId);
    if (!isOk(response, "start/resume content")) return;
    if (!response.lastWatched)
    {
        console.error("Failed to get last watched: ", response.message || "Unknown error");
        return;
    }

    activeProfile.updateLastWatched(response.lastWatched);

    // Server resets position_seconds to 0 when this isn't a true resume.
    const savedEntry = response.lastWatched.find(entry => entry.content_id === contentId);
    const resumePositionSeconds = savedEntry ? (savedEntry.position_seconds ?? 0) : 0;

    await onEpisodePlaybackStarted(contentId, response.episode, resumePositionSeconds);
    await refreshContentGrid();
}

// A movie has one episode, so resume-or-default is all that's needed.
async function handlePlayMovie(contentId)
{
    await startOrResumeContentPlayback(contentId);
}

// Renders the season-tabs + episode-list picker into the persistent episode_picker_area.
async function renderEpisodePicker(contentId)
{
    const response = await Backend.getContentEpisodes(contentId);
    if (!isOk(response, "get episodes")) return;

    currentSeriesContentId = contentId;
    currentSeriesSeasons = response.seasons ?? [];

    // Default to the season of the episode currently playing so its highlight shows.
    currentSelectedSeason = 1;
    if (currentWatchingContentId === contentId && currentWatchingEpisodeId)
    {
        const seasonIndex = currentSeriesSeasons.findIndex(
            season => season.some(episode => episode.id === currentWatchingEpisodeId)
        );
        if (seasonIndex !== -1)
        {
            currentSelectedSeason = seasonIndex + 1;
        }
    }

    const episodePickerArea = document.getElementById(EPISODE_PICKER_AREA_ID);
    if (!episodePickerArea) return;

    episodePickerArea.innerHTML = `
        <div class="episode_picker w-100 p-4" dir="ltr">
            <ul class="nav nav-tabs" id="season_tabs_container"></ul>
            <div id="episode_list_container" class="row g-3 mt-3"></div>
        </div>
    `;

    renderSeasonTabs();
    renderEpisodeList(currentSelectedSeason);
}

function renderSeasonTabs()
{
    const seasonTabsContainer = document.getElementById('season_tabs_container');
    if (!seasonTabsContainer || !currentSeriesSeasons) return;

    seasonTabsContainer.innerHTML = currentSeriesSeasons.map((_, seasonIndex) =>
    {
        const seasonNumber = seasonIndex + 1;
        const isActive = seasonNumber === currentSelectedSeason;
        return `
            <li class="nav-item">
                <button type="button" class="nav-link ${isActive ? 'active' : ''}" data-action="season" data-season="${seasonNumber}">
                    Season ${seasonNumber}
                </button>
            </li>
        `;
    }).join('');
}

function renderEpisodeList(seasonNumber)
{
    const episodeListContainer = document.getElementById('episode_list_container');
    if (!episodeListContainer || !currentSeriesSeasons) return;

    const episodes = currentSeriesSeasons[seasonNumber - 1] ?? [];

    episodeListContainer.innerHTML = episodes.map(episode =>
    {
        const isPlaying = episode.id === currentWatchingEpisodeId;
        return `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2">
            <button type="button" class="btn ${isPlaying ? 'btn-danger' : 'btn-outline-light'} w-100 h-100"
                    data-action="episode" data-episode-id="${escapeHtml(episode.id)}" aria-pressed="${isPlaying}">
                Episode ${episode.episodeNumber} - ${escapeHtml(episode.title)}
            </button>
        </div>
    `;
    }).join('');

    if (episodes.length === 0)
    {
        renderEmptyState(episodeListContainer, "No episodes found for this season");
    }
}

function handleSeasonTabClick(seasonNumber)
{
    currentSelectedSeason = seasonNumber;
    renderSeasonTabs();
    renderEpisodeList(seasonNumber);
}

// Reports the current playback position for the playing episode; no-ops if nothing plays.
async function sendWatchProgress()
{
    if (!currentWatchingContentId || !currentWatchingEpisodeId) return;

    const positionSeconds = Math.floor(videoElement.currentTime);
    const response = await Backend.updateWatchProgress(
        token, activeProfileId, currentWatchingContentId, currentWatchingEpisodeId, positionSeconds
    );
    if (!isOk(response, "update watch progress")) return;

    // Keep the in-memory lastWatched entry in sync with the saved position.
    const savedPositionSeconds = response.positionSeconds ?? positionSeconds;
    const updatedLastWatched = activeProfile.lastWatched.map(entry =>
        entry.content_id === currentWatchingContentId
            ? { ...entry, position_seconds: savedPositionSeconds }
            : entry
    );
    activeProfile.updateLastWatched(updatedLastWatched);
}

// Shared bookkeeping for every playback-start path: swaps content_main_area from details ->
// player (episode_picker_area is left alone, so it stays visible), updates state, syncs the
// season picker highlighting, refreshes reviews, shows the back-to-details button.
async function onEpisodePlaybackStarted(contentId, episode, resumePositionSeconds = 0)
{
    currentWatchingContentId = contentId;
    currentWatchingEpisodeId = episode.id;

    goToLink("#");

    const contentMainArea = document.getElementById(CONTENT_MAIN_AREA_ID);
    if (contentMainArea)
    {
        contentMainArea.innerHTML = '';
        contentMainArea.appendChild(videoPlayerSection); // moves the live node - keeps its listeners
    }

    updateVideoPlayer(episode.videoUrl, episode.title, resumePositionSeconds);
    ensureBackToDetailsButton();

    if (currentSeriesContentId === contentId && currentSeriesSeasons)
    {
        currentSelectedSeason = episode.seasonNumber;
        renderSeasonTabs();
        renderEpisodeList(currentSelectedSeason);
    }

    await renderReviewsSection(contentId, episode.id);
}

// Plays a specific episode by id, recording it via the specific-episode watch endpoint.
async function playEpisodeById(contentId, episodeId)
{
    const response = await Backend.recordWatchEpisode(token, activeProfileId, contentId, episodeId);
    if (!isOk(response, "record episode watch")) return;
    if (!response.lastWatched)
    {
        console.error("Failed to get last watched: ", response.message || "Unknown error");
        return;
    }

    activeProfile.updateLastWatched(response.lastWatched);

    // Server resets position_seconds to 0 when this isn't a true resume.
    const savedEntry = response.lastWatched.find(entry => entry.content_id === contentId);
    const resumePositionSeconds = savedEntry ? (savedEntry.position_seconds ?? 0) : 0;

    await onEpisodePlaybackStarted(contentId, response.episode, resumePositionSeconds);
    await refreshContentGrid();
}

async function handleEpisodeSelect(episodeId)
{
    if (!currentSeriesContentId)
    {
        console.error("No active series to select an episode from");
        return;
    }

    await playEpisodeById(currentSeriesContentId, episodeId);
}

// Auto-advance (video 'ended' + player's "next" control). No-ops on series finale/movie.
async function playNextEpisode()
{
    if (!currentWatchingContentId || !currentWatchingEpisodeId) return;

    const response = await Backend.getNextEpisode(currentWatchingContentId, currentWatchingEpisodeId);
    if (!isOk(response, "get next episode")) return;
    if (!response.episode) return; // series finale / movie - nothing more to play

    await playEpisodeById(currentWatchingContentId, response.episode.id);
}

// Called by the player's "previous" control.
async function playPreviousEpisode()
{
    if (!currentWatchingContentId || !currentWatchingEpisodeId) return;

    const response = await Backend.getPrevEpisode(currentWatchingContentId, currentWatchingEpisodeId);
    if (!isOk(response, "get previous episode")) return;
    if (!response.episode) return; // series premiere / movie - nothing before it

    await playEpisodeById(currentWatchingContentId, response.episode.id);
}

//=============== Reviews ===============

// Renders the reviews list + add/edit form; edit mode if this profile already reviewed.
async function renderReviewsSection(contentId, episodeId)
{
    reviewsSection.classList.remove('d-none');

    currentWatchingContentId = contentId;
    currentWatchingEpisodeId = episodeId;

    const response = await Backend.searchReviews({ episode_id: episodeId });
    if (!isOk(response, "get reviews")) return;

    const reviews = response.reviews ?? [];
    const ownReview = reviews.find(review => review.profileId === activeProfileId);

    renderReviewForm(ownReview);
    renderReviewsList(reviews, ownReview);
}

function renderReviewForm(ownReview)
{
    if (!reviewFormContainer) return;

    if (ownReview)
    {
        reviewFormContainer.innerHTML = `
            <div class="review_form border border-secondary rounded p-3 mb-3" dir="ltr">
                <h5 class="text-white">Edit Your Review</h5>
                <div class="mb-2">
                    <h4 class="text-white">Rating (1-10)</h4>
                    <input type="number" id="review_rating_input" class="form-control" min="1" max="10" value="${escapeHtml(ownReview.rating)}">
                </div>
                <div class="mb-2">
                    <h4 class="text-white">Comment</h4>
                    <textarea id="review_comment_input" class="form-control" maxlength="500" rows="3">${escapeHtml(ownReview.comment ?? '')}</textarea>
                </div>
                <button type="button" class="btn btn-warning me-2" data-action="review-update">Update</button>
                <button type="button" class="btn btn-outline-danger" data-action="review-delete">Delete Review</button>
            </div>
        `;
    }
    else
    {
        reviewFormContainer.innerHTML = `
            <div class="review_form border border-secondary rounded p-3 mb-3" dir="ltr">
                <h5 class="text-white">Write a New Review</h5>
                <div class="mb-2">
                    <h4 class="text-white">Rating (1-10)</h4>
                    <input type="number" id="review_rating_input" class="form-control" min="1" max="10" value="10">
                </div>
                <div class="mb-2">
                    <h4 class="text-white">Comment (optional)</h4>
                    <textarea id="review_comment_input" class="form-control" maxlength="500" rows="3"></textarea>
                </div>
                <button type="button" class="btn btn-danger" data-action="review-submit">Submit Review</button>
            </div>
        `;
    }
}

function renderReviewsList(reviews, ownReview)
{
    if (!reviewsListContainer) return;

    if (reviews.length === 0)
    {
        renderEmptyState(reviewsListContainer, "No reviews yet for this episode", "col-12 text-center text-white bg-dark");
        return;
    }

    reviewsListContainer.innerHTML = reviews.map(review => `
        <div class="col-12">
            <div class="border border-secondary rounded p-3 text-white bg-dark" dir="ltr">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-primary">${escapeHtml(review.reviewerName || 'Unknown user')}</span>
                    <span class="fw-bold text-warning">
                        ${escapeHtml(review.rating)}/10 ${ownReview && review.id === ownReview.id ? '(Your review)' : ''}
                    </span>
                </div>
                <div>${escapeHtml(review.comment || "")}</div>
            </div>
        </div>
    `).join('');
}

// Re-renders details so average_rating/review_count reflect the review change. Skipped while
// a video is actively playing: renderContentDetails rebuilds content_main_area from scratch,
// which would detach the live <video> node mid-playback. The updated rating is picked up next
// time the person returns to the details view instead.
async function refreshContentDetailsAfterReviewChange()
{
    if (currentWatchingContentId) return;

    if (activeContentItem && activeContentItem.id === currentWatchingContentId)
    {
        await renderContentDetails(activeContentItem);
    }
}

async function handleReviewSubmit()
{
    const rating = Number(document.getElementById('review_rating_input').value);
    const comment = document.getElementById('review_comment_input').value.trim();

    const response = await Backend.addReview(token, activeProfileId, currentWatchingContentId, currentWatchingEpisodeId, rating, comment || undefined);
    if (!isOk(response, "add review")) return;
    await renderReviewsSection(currentWatchingContentId, currentWatchingEpisodeId);
    await refreshContentDetailsAfterReviewChange();
}

async function handleReviewUpdate()
{
    const rating = Number(document.getElementById('review_rating_input').value);
    const comment = document.getElementById('review_comment_input').value.trim();

    const response = await Backend.updateReview(token, activeProfileId, currentWatchingContentId, currentWatchingEpisodeId, { rating, comment });
    if (!isOk(response, "update review")) return;
    await renderReviewsSection(currentWatchingContentId, currentWatchingEpisodeId);
    await refreshContentDetailsAfterReviewChange();
}

async function handleReviewDelete()
{
    const response = await Backend.deleteReview(token, activeProfileId, currentWatchingContentId, currentWatchingEpisodeId);
    if (!isOk(response, "delete review")) return;
    await renderReviewsSection(currentWatchingContentId, currentWatchingEpisodeId);
    await refreshContentDetailsAfterReviewChange();
}

//=============== Grid, last-watched, and navigation ===============

function renderProfileDetails()
{
    if (!activeProfile) return;
    document.title = `Profile - ${activeProfile.profileName}`;

    if (profileImage)
    {
        profileImage.src = profileImageUrl(activeProfile.ImageName);
        profileImage.alt = activeProfile.profileName;
    }
}

// Maps lastWatched entries via content_id, looking up in allContentItems so a watched item
// never disappears when the grid shows a filtered subset.
async function renderLastWatched()
{
    currentLastWatchedView = 'my_list';

    lastWatchedContainer.classList.remove('d-none');
    lastWatchedHeading.textContent = "Last watched: ";
    const lastWatchedItems = activeProfile.lastWatched
        .map(entry => allContentItems.find(item => item.id === entry.content_id))
        .filter(item => item !== undefined);

    lastWatchedContainer.innerHTML = lastWatchedItems.map(item =>
    {
        const isLiked = activeProfile.likedContentIds.has(item.id);
        return renderContentCard(item, { isLiked });
    }).join('');

    if (lastWatchedItems.length === 0)
    {
        lastWatchedHeading.textContent = "No content watched";
    }
}

async function handleHomeLinkClick()
{
    const response = await Backend.getOtherProfilesRecommendations(token, activeProfile.id);
    if (!isOk(response, "get recommended categories")) return;

    const recommendedContent = response.content;
    renderContentGrid(recommendedContent);
    contentGridHeading.textContent = "Other Profiles Suggested[" + recommendedContent.length + "]: ";
}

async function handleTvShowsLinkClick()
{
    const response = await Backend.getAllContentItems({ type: "series", limit: 100 });
    if (!isOk(response, "get all content items")) return;

    filteredContentItems = response.content;
    renderContentGrid(filteredContentItems);
    contentGridHeading.textContent = "TV Shows[" + filteredContentItems.length + "]: ";
}

async function handleMoviesLinkClick()
{
    const response = await Backend.getAllContentItems({ type: "movie", limit: 100 });
    if (!isOk(response, "get all content items")) return;

    filteredContentItems = response.content;
    renderContentGrid(filteredContentItems);
    contentGridHeading.textContent = "Movies[" + filteredContentItems.length + "]: ";
}

function handleGamesLinkClick()
{
    contentGridHeading.textContent = "We dont have games....";
    filteredContentItems = [];
    renderContentGrid(filteredContentItems);
}

// released_before expects a string; sort/sortOrder use the backend's enum values.
async function handleNewAndPopularLinkClick()
{
    const currentDateIso = new Date().toISOString();
    const response = await Backend.getAllContentItems({
        released_before: currentDateIso,
        sort: "release_date",
        sortOrder: "greater_to_smaller",
        limit: 100
    });
    if (!isOk(response, "get all content items")) return;

    filteredContentItems = response.content;
    renderContentGrid(filteredContentItems);
    contentGridHeading.textContent = "News[" + filteredContentItems.length + "]: ";
}

function handleMyListLinkClick()
{
    renderLastWatched();
}

function renderContentGrid(contentItems)
{
    let gridHtml = '';
    contentItems.forEach(item =>
    {
        const isLiked = activeProfile ? activeProfile.likedContentIds.has(item.id) : false;
        gridHtml += renderContentCard(item, { isLiked });
    });

    contentGridContainer.innerHTML = gridHtml;

    if (contentItems.length === 0)
    {
        contentGridContainer.innerHTML = `<div class="col-12 text-center mt-4"><h1>No content were found</h1></div>`;
    }
}

function handleSearchClick()
{
    const searchQuery = searchInput.value.trim();
    userSearchQuery = searchQuery;
    if (searchQuery !== '')
    {
        contentGridHeading.textContent = "Search results for: " + searchQuery;
        renderContentGrid(filteredContentItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())));
    }
    else
    {
        contentGridHeading.textContent = "";
        renderContentGrid(filteredContentItems);
    }
}

//=============== Likes ===============

async function handleToggleLike(contentId)
{
    const response = await Backend.toggleContentLike(token, activeProfileId, contentId);
    if (!isOk(response, "toggle like")) return;

    activeProfile.updateLikedContentIds(response.likedContentIds);

    // Server returns the new absolute like count; a Set dedupes shared instances so each
    // distinct content object is assigned exactly once.
    const newLikesCount = response.likes;
    const matchedContentItems = new Set();

    for (const items of [filteredContentItems, allContentItems])
    {
        const matchedContentItem = items ? items.find(content => content.id === contentId) : undefined;
        if (matchedContentItem)
        {
            matchedContentItems.add(matchedContentItem);
        }
    }

    if (activeContentItem && activeContentItem.id === contentId)
    {
        matchedContentItems.add(activeContentItem);
    }

    if (matchedContentItems.size === 0)
    {
        console.error("Failed to find content");
    }

    for (const matchedContentItem of matchedContentItems)
    {
        matchedContentItem.likes = newLikesCount;
    }

    // Redraw whichever container is showing; never pull back to details while playing.
    await refreshContentGrid();
    if (currentLastWatchedView === 'my_list')
    {
        await renderLastWatched();
    }
    else if (currentLastWatchedView === 'details' && activeContentItem && !currentWatchingContentId)
    {
        await renderContentDetails(activeContentItem);
    }
}

//=============== Video player and back-to-details control ===============

// Floating button shown only while an episode is playing; stops playback back to details.
function ensureBackToDetailsButton()
{
    if (document.getElementById(BACK_TO_DETAILS_CONTAINER_ID)) return;

    const container = document.createElement('div');
    container.id = BACK_TO_DETAILS_CONTAINER_ID;
    container.className = 'position-fixed d-flex gap-2 shadow';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.zIndex = '1040';

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'btn btn-danger btn-lg';
    backButton.textContent = '⬅ Back to Content Info';
    backButton.addEventListener('click', () => withUiLock(backButton, handleBackToDetails));

    container.appendChild(backButton);
    document.body.appendChild(container);
}

function removeBackToDetailsButton()
{
    const container = document.getElementById(BACK_TO_DETAILS_CONTAINER_ID);
    if (container) container.remove();
}

// Stops playback entirely; the actual swap back to details view is done by the caller
// (handleBackToDetails re-renders content_main_area; a fresh content click replaces it too).
async function stopPlayback()
{
    if (currentWatchingContentId)
    {
        await sendWatchProgress();
    }

    videoElement.pause();
    if (progressUpdateIntervalId !== null)
    {
        clearInterval(progressUpdateIntervalId);
        progressUpdateIntervalId = null;
    }

    videoPlayerSection.classList.add('d-none');
    reviewsSection.classList.add('d-none');
    removeBackToDetailsButton();

    currentWatchingContentId = null;
    currentWatchingEpisodeId = null;
}

async function handleBackToDetails()
{
    await stopPlayback();

    if (activeContentItem)
    {
        await renderContentDetails(activeContentItem);
    }
}

function updateVideoPlayer(videoFileName, title, resumePositionSeconds = 0)
{
    const sourceElement = document.getElementById('screen_video_source');
    const titleElement = document.getElementById('screen_title');

    titleElement.textContent = title;
    sourceElement.setAttribute('src', '/assets/videos/' + videoFileName);

    // Seeking must wait for 'loadedmetadata'; { once: true } since the element is reused.
    if (resumePositionSeconds > 0)
    {
        videoElement.addEventListener('loadedmetadata', () =>
        {
            videoElement.currentTime = resumePositionSeconds;
        }, { once: true });
    }

    videoElement.load();
    videoElement.play();

    videoPlayerSection.classList.remove('d-none');

    // Restart the progress timer for the new episode; only one ever runs.
    if (progressUpdateIntervalId !== null)
    {
        clearInterval(progressUpdateIntervalId);
    }
    progressUpdateIntervalId = setInterval(sendWatchProgress, PROGRESS_UPDATE_INTERVAL_SECONDS * 1000);

    // Wire the OS media overlay's prev/next controls to episode navigation.
    if ('mediaSession' in navigator)
    {
        navigator.mediaSession.metadata = new MediaMetadata({ title });
        navigator.mediaSession.setActionHandler('nexttrack', () => { playNextEpisode(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { playPreviousEpisode(); });
    }
}

// Auto-advance when the current episode ends; report position on pause.
videoElement.addEventListener('ended', () => { playNextEpisode(); });
videoElement.addEventListener('pause', () => { sendWatchProgress(); });

//=============== Content selection, display refresh, continue-watching ===============

// Delegated clicks for grids, details, and reviews. Attached once to the containers; each
// backend action runs through withUiLock so the UI locks while the request is in flight.
function handleDelegatedClick(event)
{
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const contentId = actionElement.dataset.contentId;

    switch (action)
    {
        case 'like':
            withUiLock(actionElement, () => handleToggleLike(contentId));
            break;
        case 'open':
            withUiLock(actionElement, () => handleContentItemClick(contentId));
            break;
        case 'resume':
            withUiLock(actionElement, () => startOrResumeContentPlayback(contentId));
            break;
        case 'play-movie':
            withUiLock(actionElement, () => handlePlayMovie(contentId));
            break;
        case 'season':
            handleSeasonTabClick(Number(actionElement.dataset.season));
            break;
        case 'episode':
            withUiLock(actionElement, () => handleEpisodeSelect(actionElement.dataset.episodeId));
            break;
        case 'review-submit':
            withUiLock(actionElement, () => handleReviewSubmit());
            break;
        case 'review-update':
            withUiLock(actionElement, () => handleReviewUpdate());
            break;
        case 'review-delete':
            withUiLock(actionElement, () => handleReviewDelete());
            break;
    }
}

// A card click always shows details; playback starts only from a button in that view.
async function handleContentItemClick(contentId)
{
    dismissContinueWatchingButton();

    // Fall back to allContentItems when the grid shows only a filtered subset.
    activeContentItem = filteredContentItems.find(content => content.id === contentId)
        ?? (allContentItems ? allContentItems.find(content => content.id === contentId) : undefined);
    if (!activeContentItem)
    {
        console.error("Failed to find content");
        return;
    }

    currentLastWatchedView = 'details';

    // Stop any current playback before showing the newly clicked content's details.
    await stopPlayback();

    goToLink("#");
    await renderContentDetails(activeContentItem);
}

async function refreshContentGrid()
{
    renderContentGrid(filteredContentItems.filter(item => item.title.toLowerCase().includes(userSearchQuery.toLowerCase())));
}

// Pinned button shown on first page entry; resumes the most recent last-watched episode.
// Dismissed once the user opens a content's details (which has its own Resume button).
function renderContinueWatchingButton()
{
    if (!activeProfile || !Array.isArray(activeProfile.lastWatched) || activeProfile.lastWatched.length === 0) return;
    if (document.getElementById('continue_watching_pinned')) return;

    // lastWatched is newest-first (server unshifts), so index 0 is the most recent.
    const lastEntry = activeProfile.lastWatched[0];
    const lastWatchedContentItem = allContentItems ? allContentItems.find(item => item.id === lastEntry.content_id) : undefined;
    if (!lastWatchedContentItem) return;

    const button = document.createElement('button');
    button.id = 'continue_watching_pinned';
    button.type = 'button';
    button.className = 'btn btn-danger position-fixed start-0 m-3 shadow';
    button.setAttribute('dir', 'ltr');
    button.textContent = `▶ Continue: ${lastWatchedContentItem.title}`;

    button.addEventListener('click', () => withUiLock(button, async () =>
    {
        dismissContinueWatchingButton();
        await startOrResumeContentPlayback(lastEntry.content_id);
    }));

    document.body.appendChild(button);
}

function dismissContinueWatchingButton()
{
    const button = document.getElementById('continue_watching_pinned');
    if (button) button.remove();
}

//=============== Init ===============

async function init()
{
    if (!await ClientSessionManager.isLoggedIn())
    {
        lockUi(contentGridContainer);
        showErrorMessage("Not logged in");
        goToLink('/');
        return;
    }

    if (!activeProfileId)
    {
        lockUi(contentGridContainer);
        showErrorMessage("No profile selected");
        goToLink('/html/profiles.html');
        return;
    }

    // Includes last-watched entries and liked content ids.
    const profileDetailsResponse = await Backend.fetchProfileDetails(token, activeProfileId);
    if (!profileDetailsResponse || !profileDetailsResponse.success)
    {
        lockUi(contentGridContainer);
        showErrorMessage("Error getting active profile");
        return;
    }
    activeProfile = Profile.fromJSON(profileDetailsResponse.profile);

    const allContentResponse = await Backend.getAllContentItems();
    if (!allContentResponse || !allContentResponse.success)
    {
        lockUi(contentGridContainer);
        showErrorMessage("Error getting content items");
        return;
    }

    // allContentItems stays the full catalog; filteredContentItems gets filtered per nav click.
    allContentItems = allContentResponse.content;
    filteredContentItems = allContentItems;

    await refreshContentGrid();
    await renderLastWatched();
    renderContinueWatchingButton();

    searchButton.addEventListener('click', handleSearchClick);
    searchInput.addEventListener('keypress', (keyboardEvent) => { if (keyboardEvent.key === 'Enter') handleSearchClick(); });

    // Delegated clicks for grids (open/like), details (resume/play/season/episode), and reviews.
    contentGridContainer.addEventListener('click', handleDelegatedClick);
    lastWatchedContainer.addEventListener('click', handleDelegatedClick);
    reviewsSection.addEventListener('click', handleDelegatedClick);

    renderProfileDetails();
}

init();