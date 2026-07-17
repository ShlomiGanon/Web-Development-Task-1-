//i know this code is can be reused for other pages but i dont have time to refactor it , sorry for that.
import { Profile, ContentItem } from './BACKEND_API/backend-interface.js';
import { Backend } from './config.js';
import { ClientSessionManager } from './client-session-manager.js';
import * as UI from './ui-utils.js';

// How often (in seconds) to report the current playback position to the server while
// a video is playing. Also sent once immediately whenever playback is paused.
const PROGRESS_UPDATE_INTERVAL_SECONDS = 10;

let active_content = null;
const last_watched_container = document.getElementById('last_watched_container');
const last_watched_text = document.getElementById('last_watched_text');
const all_content_container = document.getElementById('all_content_container');
const all_content_text = document.getElementById('all_content_text');
const search_button = document.getElementById('search_button');
const search_input = document.getElementById('search_input');
const profile_image = document.getElementById('profile_image');
const screen_title = document.getElementById('screen_title');
const screen_video = document.getElementById('screen_video');
const video_player_section = document.getElementById('video_player_section');
const home_link = document.getElementById('home_link');
home_link.addEventListener('click', home_link_on_click);
const tv_shows_link = document.getElementById('tv_shows_link');
tv_shows_link.addEventListener('click', tv_shows_link_on_click);
const movies_link = document.getElementById('movies_link');
movies_link.addEventListener('click', movies_link_on_click);
const games_link = document.getElementById('games_link');
games_link.addEventListener('click', games_link_on_click);
const new_and_popular_link = document.getElementById('new_and_popular_link');
new_and_popular_link.addEventListener('click', new_and_popular_link_on_click);
const my_list_link = document.getElementById('my_list_link');
my_list_link.addEventListener('click', my_list_link_on_click);
const review_form_container = document.getElementById('review_form_container');
const reviews_list_container = document.getElementById('reviews_list_container');
const reviews_section = document.getElementById('reviews_section');

// details and player share the same on-screen spot: last_watched_container holds
// details, video_player_section + reviews_section sit right after it and take over
// visually (d-none toggling) whenever something is playing. Positioned once, here,
// instead of being moved around on every render.
last_watched_container.insertAdjacentElement('afterend', video_player_section);
video_player_section.insertAdjacentElement('afterend', reviews_section);
video_player_section.classList.add('d-none');
reviews_section.classList.add('d-none');

let User_Search_Value = '';
let activeProfile = null;
// Content_Items = whatever's shown in the grid right now (changes per nav click/search).
// All_Content_Items = the full catalog, fetched once and never overwritten - used for
// lookups (e.g. My List) so a watched item never "disappears" just because the grid changed.
let Content_Items = null;
let All_Content_Items = null;
// What's drawn in last_watched_container right now: 'details' or 'my_list' - lets
// handleToggleLike() know whether it needs to redraw this container after a like.
let Current_Last_Watched_View = null;
// Episode picker state - only relevant while viewing a "series" content item's details.
let Current_Series_Content_Id = null;
let Current_Series_Seasons = null; // Array<Array<Episode>> - seasons[0] = season 1, etc.
let Current_Selected_Season = 1;
// Whichever content/episode is currently playing - also doubles as the details/player
// state flag: set -> player is showing; null -> details is showing.
let Current_Watching_Content_Id = null;
let Current_Watching_Episode_Id = null;
// Handle of the periodic progress-reporting timer for whatever episode is currently
// loaded - restarted on every new episode load, so only one timer is ever running.
let progressUpdateIntervalId = null;
const token = ClientSessionManager.getSessionToken();
const activeProfileId = ClientSessionManager.getActiveProfileId();

function escapeHtml(value)
{
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function randerContentItems(content_item)
{
    const response = await Backend.getContentByID(content_item.id);
    if (!response || !response.success)
    {
        console.error("Failed to get content item: ", response.message || "Unknown error");
        return;
    }

    const rawContent = response.content; // exactly what the server sent, field for field
    content_item = ContentItem.fromJSON(rawContent);

    last_watched_container.classList.remove('d-none');
    last_watched_text.textContent = escapeHtml(content_item.title);
    last_watched_container.innerHTML = "";

    const typeLabel = content_item.type === 'series' ? 'Series' : 'Movie';
    const categoriesLabel = content_item.categories.length > 0 ? content_item.categories.join(', ') : 'No category';
    const releaseDateLabel = content_item.release_date instanceof Date && !isNaN(content_item.release_date)
        ? content_item.release_date.toLocaleDateString('en-US')
        : 'Unknown';

    const isLiked = activeProfile ? activeProfile.likedContentIds.has(content_item.id) : false;
    const likeButtonHtml = `
        <button type="button" class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} fs-6"
                onclick="handleToggleLike('${content_item.id}')">
            ${isLiked ? `${escapeHtml(content_item.likes)} 💔` : `${escapeHtml(content_item.likes)} ❤️`}
        </button>
    `;

    const badges = [
        `<span class="badge bg-danger fs-6">${escapeHtml(typeLabel)}</span>`,
        `<span class="badge bg-secondary fs-6">Age ${escapeHtml(content_item.age_limit)}+</span>`,
        likeButtonHtml,
    ];
    if (content_item.imdb_rating !== null && content_item.imdb_rating !== undefined)
    {
        badges.push(`<span class="badge bg-warning text-dark fs-6">⭐ IMDB ${escapeHtml(content_item.imdb_rating)}</span>`);
    }
    if (content_item.review_count > 0)
    {
        badges.push(`<span class="badge bg-primary fs-6">★ ${escapeHtml(content_item.average_rating.toFixed(1))} (${escapeHtml(content_item.review_count)} reviews)</span>`);
    }

    // Shown above the badges, next to the title, only if this profile has watch history
    // for this specific content - jumps straight into playback from where it was left off.
    const hasWatchHistory = activeProfile ? activeProfile.lastWatched.some(entry => entry.content_id === content_item.id) : false;
    const resumeButtonHtml = hasWatchHistory
        ? `<button type="button" class="btn btn-danger btn-lg" onclick="startOrResumeContentPlayback('${content_item.id}')">▶ Resume Watching</button>`
        : '';

    const contentHtml = `
    <div class="w-100 p-4" dir="ltr">
        <div class="row g-4 align-items-start">
            <div class="col-12 col-md-4 text-center">
                <img src="../assets/covers/${escapeHtml(content_item.cover_image_name)}"
                     class="img-fluid rounded shadow"
                     style="max-height: 450px; width: 100%; object-fit: cover;"
                     alt="${escapeHtml(content_item.title)}">
            </div>
            <div class="col-12 col-md-8">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h1 class="fw-bold text-white m-0">${escapeHtml(content_item.title)}</h1>
                    ${resumeButtonHtml}
                </div>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    ${badges.join('\n                    ')}
                </div>
                <p class="text-light fs-5" style="white-space: pre-wrap;">${escapeHtml(content_item.description) || 'No description available'}</p>
                <div class="text-secondary mt-3">
                    <div><span class="fw-bold text-secondary">Categories:</span> ${escapeHtml(categoriesLabel)}</div>
                    <div><span class="fw-bold text-secondary">Release Date:</span> ${escapeHtml(releaseDateLabel)}</div>
                </div>
            </div>
        </div>
    </div>
    `;
    last_watched_container.innerHTML = contentHtml;

    // Series get an episode picker; movies (single Episode under the hood) just get a play button.
    if (content_item.type === "series")
    {
        await renderEpisodePicker(content_item.id);
    }
    else if (content_item.type === "movie")
    {
        Current_Series_Content_Id = null;
        Current_Series_Seasons = null;
        renderMoviePlayButton(content_item.id);
    }
    else
    {
        Current_Series_Content_Id = null;
        Current_Series_Seasons = null;
    }
}

function renderMoviePlayButton(contentId)
{
    const playButtonHtml = `
        <div class="w-100 p-4 text-center" dir="ltr">
            <button type="button" class="btn btn-danger btn-lg" onclick="handlePlayMovie('${contentId}')">
                ▶ Play Movie
            </button>
        </div>
    `;
    last_watched_container.insertAdjacentHTML('beforeend', playButtonHtml);
}

// Resumes saved progress if it exists, otherwise starts at S1E1. Used by the movie
// "play" button, the series "resume watching" button, and the play button.
async function startOrResumeContentPlayback(contentId)
{
    const response = await Backend.selectContentItem(token, activeProfileId, contentId);
    if (!response || !response.success)
    {
        console.error("Failed to start/resume content: ", response.message || "Unknown error");
        return;
    }
    if (!response.lastWatched)
    {
        console.error("Failed to get last watched: ", response.message || "Unknown error");
        return;
    }

    activeProfile.updateLastWatched(response.lastWatched);

    // The entry for this content carries the position_seconds to resume from - the
    // server already resets it to 0 when this isn't a true resume (see backend notes).
    const savedEntry = response.lastWatched.find(entry => entry.content_id === contentId);
    const resumePositionSeconds = savedEntry ? (savedEntry.position_seconds ?? 0) : 0;

    await onEpisodePlaybackStarted(contentId, response.episode, resumePositionSeconds);
    await refreshDisplay();
}

// A movie only ever has one episode (S1E1), so resume-or-default is exactly what's needed.
async function handlePlayMovie(contentId)
{
    await startOrResumeContentPlayback(contentId);
}

// Fetches all seasons/episodes for a series and renders a season-tabs + episode-list
// picker inside last_watched_container, right below the content details. Clicking a
// season tab swaps which season's episodes are listed; clicking an episode plays it
// immediately (same behavior as clicking a content card).
async function renderEpisodePicker(contentId)
{
    const response = await Backend.getContentEpisodes(contentId);
    if (!response || !response.success)
    {
        console.error("Failed to get episodes: ", response.message || "Unknown error");
        return;
    }

    Current_Series_Content_Id = contentId;
    Current_Series_Seasons = response.seasons ?? [];

    // Default to the season containing the episode currently playing, if any, so the
    // "now playing" highlight shows immediately instead of resetting to season 1.
    Current_Selected_Season = 1;
    if (Current_Watching_Content_Id === contentId && Current_Watching_Episode_Id)
    {
        const seasonIndex = Current_Series_Seasons.findIndex(
            season => season.some(ep => ep.id === Current_Watching_Episode_Id)
        );
        if (seasonIndex !== -1)
        {
            Current_Selected_Season = seasonIndex + 1;
        }
    }

    const pickerHtml = `
        <div class="episode_picker w-100 p-4" dir="ltr">
            <ul class="nav nav-tabs" id="season_tabs_container"></ul>
            <div id="episode_list_container" class="row g-3 mt-3"></div>
        </div>
    `;
    last_watched_container.insertAdjacentHTML('beforeend', pickerHtml);

    renderSeasonTabs();
    renderEpisodeList(Current_Selected_Season);
}

function renderSeasonTabs()
{
    const seasonTabsContainer = document.getElementById('season_tabs_container');
    if (!seasonTabsContainer || !Current_Series_Seasons) return;

    seasonTabsContainer.innerHTML = Current_Series_Seasons.map((_, index) =>
    {
        const seasonNumber = index + 1;
        const isActive = seasonNumber === Current_Selected_Season;
        return `
            <li class="nav-item">
                <button type="button" class="nav-link ${isActive ? 'active' : ''}" onclick="handleSeasonTabClick(${seasonNumber})">
                    Season ${seasonNumber}
                </button>
            </li>
        `;
    }).join('');
}

function renderEpisodeList(seasonNumber)
{
    const episodeListContainer = document.getElementById('episode_list_container');
    if (!episodeListContainer || !Current_Series_Seasons) return;

    const episodes = Current_Series_Seasons[seasonNumber - 1] ?? [];

    episodeListContainer.innerHTML = episodes.map(ep =>
    {
        const isPlaying = ep.id === Current_Watching_Episode_Id;
        return `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2">
            <button type="button" class="btn ${isPlaying ? 'btn-danger' : 'btn-outline-light'} w-100 h-100"
                    onclick="handleEpisodeSelect('${ep.id}')" aria-pressed="${isPlaying}">
                Episode ${ep.episodeNumber} - ${escapeHtml(ep.title)}
            </button>
        </div>
    `;
    }).join('');

    if (episodes.length === 0)
    {
        episodeListContainer.innerHTML = `<div class="col-12 text-center" dir="ltr">No episodes found for this season</div>`;
    }
}

function handleSeasonTabClick(seasonNumber)
{
    Current_Selected_Season = seasonNumber;
    renderSeasonTabs();
    renderEpisodeList(seasonNumber);
}

// Reports the current playback position (screen_video.currentTime) to the server for
// whichever episode is playing right now. Called periodically (every
// PROGRESS_UPDATE_INTERVAL_SECONDS, via the timer started in updateVideoPlayer) and once
// immediately whenever playback is paused. No-ops if nothing is currently playing.
async function sendWatchProgress()
{
    if (!Current_Watching_Content_Id || !Current_Watching_Episode_Id) return;

    const positionSeconds = Math.floor(screen_video.currentTime);
    const response = await Backend.updateWatchProgress(
        token, activeProfileId, Current_Watching_Content_Id, Current_Watching_Episode_Id, positionSeconds
    );
    if (!response || !response.success)
    {
        console.error("Failed to update watch progress: ", (response && response.message) || "Unknown error");
        return;
    }

    // Keep the in-memory profile's lastWatched entry in sync with what the server just
    // saved, so anything reading activeProfile.lastWatched reflects the latest position.
    const savedPositionSeconds = response.positionSeconds ?? positionSeconds;
    const updatedLastWatched = activeProfile.lastWatched.map(entry =>
        entry.content_id === Current_Watching_Content_Id
            ? { ...entry, position_seconds: savedPositionSeconds }
            : entry
    );
    activeProfile.updateLastWatched(updatedLastWatched);
}

// Shared bookkeeping for every playback-start path (episode pick, resume, auto-advance,
// prev/next controls): swaps details -> player, updates state, syncs the season picker,
// refreshes reviews, shows the floating "back to details" button.
async function onEpisodePlaybackStarted(contentId, episode, resumePositionSeconds = 0)
{
    Current_Watching_Content_Id = contentId;
    Current_Watching_Episode_Id = episode.id;

    UI.GoToLink("#");
    last_watched_container.classList.add('d-none');
    updateVideoPlayer(episode.videoUrl, episode.title, resumePositionSeconds);
    ensureBackToDetailsButton();

    if (Current_Series_Content_Id === contentId && Current_Series_Seasons)
    {
        Current_Selected_Season = episode.seasonNumber;
        renderSeasonTabs();
        renderEpisodeList(Current_Selected_Season);
    }

    await renderReviewsSection(contentId, episode.id);
}

// Plays a specific episode by id (records it as watched via the specific-episode watch
// endpoint, not the resume-default one) and runs the shared post-playback bookkeeping.
async function playEpisodeById(contentId, episodeId)
{
    const response = await Backend.recordWatchEpisode(token, activeProfileId, contentId, episodeId);
    if (!response || !response.success)
    {
        console.error("Failed to record episode watch: ", response.message || "Unknown error");
        return;
    }
    if (!response.lastWatched)
    {
        console.error("Failed to get last watched: ", response.message || "Unknown error");
        return;
    }

    activeProfile.updateLastWatched(response.lastWatched);

    // The entry for this content carries the position_seconds to resume from - the
    // server already resets it to 0 when this isn't a true resume (see backend notes).
    const savedEntry = response.lastWatched.find(entry => entry.content_id === contentId);
    const resumePositionSeconds = savedEntry ? (savedEntry.position_seconds ?? 0) : 0;

    await onEpisodePlaybackStarted(contentId, response.episode, resumePositionSeconds);
    await refreshDisplay();
}

// Plays the chosen episode immediately - called when a specific episode button is
// clicked in the season picker.
async function handleEpisodeSelect(episodeId)
{
    if (!Current_Series_Content_Id)
    {
        console.error("No active series to select an episode from");
        return;
    }

    await playEpisodeById(Current_Series_Content_Id, episodeId);
}

// Auto-advance (video 'ended' + player's "next" control). No-ops on series finale/movie.
async function playNextEpisode()
{
    if (!Current_Watching_Content_Id || !Current_Watching_Episode_Id) return;

    const response = await Backend.getNextEpisode(Current_Watching_Content_Id, Current_Watching_Episode_Id);
    if (!response || !response.success)
    {
        console.error("Failed to get next episode: ", response.message || "Unknown error");
        return;
    }
    if (!response.episode) return; // series finale / movie - nothing more to play

    await playEpisodeById(Current_Watching_Content_Id, response.episode.id);
}

// Called by the player's "previous" control.
async function playPrevEpisode()
{
    if (!Current_Watching_Content_Id || !Current_Watching_Episode_Id) return;

    const response = await Backend.getPrevEpisode(Current_Watching_Content_Id, Current_Watching_Episode_Id);
    if (!response || !response.success)
    {
        console.error("Failed to get previous episode: ", response.message || "Unknown error");
        return;
    }
    if (!response.episode) return; // series premiere / movie - nothing before it

    await playEpisodeById(Current_Watching_Content_Id, response.episode.id);
}

// Renders the reviews list + add/edit form. Switches to edit/delete mode if this
// profile already reviewed the episode (a profile can only review one once).
async function renderReviewsSection(contentId, episodeId)
{
    reviews_section.classList.remove('d-none');

    Current_Watching_Content_Id = contentId;
    Current_Watching_Episode_Id = episodeId;

    const response = await Backend.searchReviews({ episode_id: episodeId });
    if (!response || !response.success)
    {
        console.error("Failed to get reviews: ", response.message || "Unknown error");
        return;
    }

    const reviews = response.reviews ?? [];
    const ownReview = reviews.find(r => r.profileId === activeProfileId);

    renderReviewForm(ownReview);
    renderReviewsList(reviews, ownReview);
}

function renderReviewForm(ownReview)
{
    if (!review_form_container) return;
    
    if (ownReview)
    {
        review_form_container.innerHTML = `
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
                <button type="button" class="btn btn-warning me-2" onclick="handleReviewUpdate()">Update</button>
                <button type="button" class="btn btn-outline-danger" onclick="handleReviewDelete()">Delete Review</button>
            </div>
        `;
    }
    else
    {
        review_form_container.innerHTML = `
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
                <button type="button" class="btn btn-danger" onclick="handleReviewSubmit()">Submit Review</button>
            </div>
        `;
    }
}

// No endpoint returns a profile's display name with a review, so only rating/comment
// are shown - the current profile's own review is labeled inline since we know its id.
function renderReviewsList(reviews, ownReview)
{
    if (!reviews_list_container) return;

    if (reviews.length === 0)
    {
        reviews_list_container.innerHTML = `<div class="col-12 text-center text-white bg-dark" dir="ltr">No reviews yet for this episode</div>`;
        return;
    }

    const empty_review_text = "";
    reviews_list_container.innerHTML = reviews.map(review => `
        <div class="col-12">
            <div class="border border-secondary rounded p-3 text-white bg-dark" dir="ltr">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold text-primary">${escapeHtml(review.reviewerName || 'Unknown user')}</span>
                    <span class="fw-bold text-warning">
                        ${escapeHtml(review.rating)}/10 ${ownReview && review.id === ownReview.id ? '(Your review)' : ''}
                    </span>
                </div>
                <div>${escapeHtml(review.comment || empty_review_text)}</div>
            </div>
        </div>
    `).join('');
}


// Re-renders content details so average_rating/review_count reflect the review change.
async function refreshContentDetailsAfterReviewChange()
{
    if (active_content && active_content.id === Current_Watching_Content_Id)
    {
        await randerContentItems(active_content);
    }
}

async function handleReviewSubmit()
{
    const rating = Number(document.getElementById('review_rating_input').value);
    const comment = document.getElementById('review_comment_input').value.trim();

    const response = await Backend.addReview(token, activeProfileId, Current_Watching_Content_Id, Current_Watching_Episode_Id, rating, comment || undefined);
    if (!response || !response.success)
    {
        console.error("Failed to add review: ", response.message || "Unknown error");
        return;
    }
    await renderReviewsSection(Current_Watching_Content_Id, Current_Watching_Episode_Id);
    await refreshContentDetailsAfterReviewChange();
}

async function handleReviewUpdate()
{
    const rating = Number(document.getElementById('review_rating_input').value);
    const comment = document.getElementById('review_comment_input').value.trim();

    const response = await Backend.updateReview(token, activeProfileId, Current_Watching_Content_Id, Current_Watching_Episode_Id, { rating, comment });
    if (!response || !response.success)
    {
        console.error("Failed to update review: ", response.message || "Unknown error");
        return;
    }
    await renderReviewsSection(Current_Watching_Content_Id, Current_Watching_Episode_Id);
    await refreshContentDetailsAfterReviewChange();
}

async function handleReviewDelete()
{
    const response = await Backend.deleteReview(token, activeProfileId, Current_Watching_Content_Id, Current_Watching_Episode_Id);
    if (!response || !response.success)
    {
        console.error("Failed to delete review: ", response.message || "Unknown error");
        return;
    }
    await renderReviewsSection(Current_Watching_Content_Id, Current_Watching_Episode_Id);
    await refreshContentDetailsAfterReviewChange();
}

function randerProfileDetails()
{
    if (!activeProfile) return;
    document.title = `Profile - ${activeProfile.profileName}`;

    if (profile_image)
    {
        profile_image.src = `../assets/profiles_images/${activeProfile.ImageName}`;
        profile_image.alt = activeProfile.profileName;
    }
}

// lastWatched is { episode_id, content_id, position_seconds } entries, not flat content
// ids - mapped via content_id. Looks up items in All_Content_Items (not Content_Items),
// so a watched item never silently disappears just because the grid is currently
// showing a filtered subset.
async function renderLastWatched()
{
    Current_Last_Watched_View = 'my_list';

    last_watched_container.classList.remove('d-none');
    last_watched_text.textContent = "Last watched: ";
    const lastWatchedItems = activeProfile.lastWatched
        .map(entry => All_Content_Items.find(m => m.id === entry.content_id))
        .filter(m => m !== undefined);

    last_watched_container.innerHTML = lastWatchedItems.map(item =>
    {
        const isLiked = activeProfile.likedContentIds.has(item.id);
        return `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 content_item">
                <img src="../assets/covers/${item.cover_image_name}" class="img-fluid rounded content_image" 
                alt="${item.title}" 
                onclick="click_on_content_item('${item.id}')">
                <div class="content_name text-center text-truncate px-1">${item.title}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike('${item.id}')">
                    ${isLiked ? `${item.likes} 💔(unlike)` : `${item.likes} ❤️(like)`}
                </button>
            </div>
        `;
    }).join('');

    if (lastWatchedItems.length === 0)
    {
        last_watched_text.textContent = "No content watched";
    }
}

// NOTE: was Backend.getContentOthersEngagedWith() - that method doesn't exist on the
// current client. The correct name is getOtherProfilesRecommendations().
async function home_link_on_click()
{
    const response = await Backend.getOtherProfilesRecommendations(token, activeProfile.id);
    if (!response || !response.success)
    {
        console.error("Failed to get recommended categories: ", response.message || "Unknown error");
        return;
    }
    else
    {
        const content_others_engaged_with = response.content;
        renderAllContentItems(content_others_engaged_with);
        all_content_text.textContent = "Other Profiles Suggested[" + content_others_engaged_with.length + "]: ";
    }
}

async function tv_shows_link_on_click()
{
    const response = await Backend.getAllContentItems({ type: "series", limit: 100 });
    if (!response || !response.success)
    {
        console.error("Failed to get all content items: ", response.message || "Unknown error");
        return;
    }
    else
    {
        const content_items = response.content;
        Content_Items = content_items;
        renderAllContentItems(Content_Items);
        all_content_text.textContent = "TV Shows[" + Content_Items.length + "]: ";
    }
}

async function movies_link_on_click()
{
    const response = await Backend.getAllContentItems({ type: "movie", limit: 100 });
    if (!response || !response.success)
    {
        console.error("Failed to get all content items: ", response.message || "Unknown error");
        return;
    }
    else
    {
        const content_items = response.content;
        Content_Items = content_items;
        renderAllContentItems(Content_Items);
        all_content_text.textContent = "Movies[" + Content_Items.length + "]: ";
    }
}

async function games_link_on_click()
{
    all_content_text.textContent = "We dont have games....";
    Content_Items = [];
    renderAllContentItems(Content_Items);
}

// Query params must be `sort`/`sortOrder` ("greater_to_smaller"/"smaller_to_greater"),
// and released_before expects a string, not a raw Date.
async function new_and_popular_link_on_click()
{
    const current_date = new Date().toISOString();
    const response = await Backend.getAllContentItems({
        released_before: current_date,
        sort: "release_date",
        sortOrder: "greater_to_smaller",
        limit: 100
    });
    if (!response || !response.success)
    {
        console.error("Failed to get all content items: ", response.message || "Unknown error");
        return;
    }
    else
    {
        const content_items = response.content;
        Content_Items = content_items;
        renderAllContentItems(Content_Items);
        all_content_text.textContent = "News[" + Content_Items.length + "]: ";
    }
}

function my_list_link_on_click()
{
    renderLastWatched();
}

async function renderAllContentItems(content_items)
{
    let html_content = '';

    // Build the movie item cards
    content_items.forEach(item =>
    {
        const isLiked = activeProfile ? activeProfile.likedContentIds.has(item.id) : false;
        html_content += `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 content_item">
                <img src="../assets/covers/${item.cover_image_name}" 
                     class="img-fluid rounded content_image" 
                     alt="${item.title}" 
                     onclick="click_on_content_item('${item.id}')">
                <div class="content_name text-center text-truncate px-1">${item.title}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike('${item.id}')">
                    ${isLiked ? `${item.likes} 💔(unlike)` : `${item.likes} ❤️(like)`}
                </button>
            </div>
        `;
    });

    // Update the DOM once with the fully constructed HTML string
    all_content_container.innerHTML = html_content;

    // Handle empty results case
    if (content_items.length === 0)
    {
        all_content_container.innerHTML = `<div class="col-12 text-center mt-4"><h1>No content were found</h1></div>`;
    }
}

async function search_on_click()
{
    const search_value = search_input.value.trim();
    User_Search_Value = search_value;
    if (search_value !== '')
    {
        all_content_text.textContent = "Search results for: " + search_value;
        await renderAllContentItems(Content_Items.filter(item => item.title.toLowerCase().includes(search_value.toLowerCase())));
    }
    else
    {
        all_content_text.textContent = "";
        await renderAllContentItems(Content_Items);
    }
}

// NOTE: was activeProfile.update_wasLiked_Content_IDs(...) - that method doesn't exist on
// Profile. The correct method is updateLikedContentIds(...).
// NOTE: was activeProfile.update_wasLiked_Content_IDs(...) - that method doesn't exist on
// Profile. The correct method is updateLikedContentIds(...).
async function handleToggleLike(ContentID)
{
    const response = await Backend.toggleContentLike(token, activeProfileId, ContentID);
    if (!response || !response.success)
    {
        console.error("Failed to toggle like: ", response.message || "Unknown error");
        return;
    }
    else
    {
        const updated_likedContentIds = response.likedContentIds;
        activeProfile.updateLikedContentIds(updated_likedContentIds);

        // The server returns the content's new total like count, so we just assign it
        // (idempotent) instead of computing a +1/-1 delta. Content_Items, All_Content_Items
        // and active_content may point to the same instance or to separate copies - a Set
        // dedupes by identity so each distinct instance is set exactly once.
        const newLikesCount = response.likes;

        const matchedContentItems = new Set();

        for (const items of [Content_Items, All_Content_Items])
        {
            const pressed_content = items ? items.find(content => content.id === ContentID) : undefined;
            if (pressed_content)
            {
                matchedContentItems.add(pressed_content);
            }
        }

        if (active_content && active_content.id === ContentID)
        {
            matchedContentItems.add(active_content);
        }

        if (matchedContentItems.size === 0)
        {
            console.error("Failed to find content");
        }

        for (const pressed_content of matchedContentItems)
        {
            pressed_content.likes = newLikesCount;
        }

        // Redraw whichever container is actually showing, so the like state never goes stale.
        // Only touches the details view if it's actually the visible one - never yanks the
        // screen back to details while the video player is showing.
        await refreshDisplay();
        if (Current_Last_Watched_View === 'my_list')
        {
            await renderLastWatched();
        }
        else if (Current_Last_Watched_View === 'details' && active_content && !Current_Watching_Content_Id)
        {
            await randerContentItems(active_content);
        }
    }
}

const BACK_TO_DETAILS_CONTAINER_ID = 'back_to_details_container';

// Floating button shown only while an episode is playing - same spot/style the old
// "Continue Watching" panel used to occupy. Stops playback and swaps back to details.
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
    backButton.addEventListener('click', handleBackToDetails);

    container.appendChild(backButton);
    document.body.appendChild(container);
}

function removeBackToDetailsButton()
{
    const container = document.getElementById(BACK_TO_DETAILS_CONTAINER_ID);
    if (container) container.remove();
}

// Stops playback entirely (not just paused) and swaps the shared display spot back
// to the content details + episode list. Sends one last progress update first, since
// the periodic timer's last tick might be up to PROGRESS_UPDATE_INTERVAL_SECONDS stale.
async function stopPlayback()
{
    if (Current_Watching_Content_Id)
    {
        await sendWatchProgress();
    }

    screen_video.pause();
    if (progressUpdateIntervalId !== null)
    {
        clearInterval(progressUpdateIntervalId);
        progressUpdateIntervalId = null;
    }

    video_player_section.classList.add('d-none');
    reviews_section.classList.add('d-none');
    removeBackToDetailsButton();

    Current_Watching_Content_Id = null;
    Current_Watching_Episode_Id = null;
}

async function handleBackToDetails()
{
    await stopPlayback();

    if (active_content)
    {
        await randerContentItems(active_content);
    }
}

// Shown only once something is actually playing - video_player_section starts hidden
// (class "d-none") until the first call here.
function updateVideoPlayer(videoUrl, title, resumePositionSeconds = 0)
{
    const videoElement = document.getElementById('screen_video');
    const sourceElement = document.getElementById('screen_video_source');
    const titleElement = document.getElementById('screen_title');

    titleElement.textContent = title;
    sourceElement.setAttribute('src', '/assets/videos/' + videoUrl);

    // Seeking has to wait for 'loadedmetadata' - setting currentTime any earlier (e.g.
    // right after load()) is unreliable and gets silently ignored in some browsers,
    // since the video doesn't know its own duration yet. { once: true } is required
    // because videoElement itself is reused across episodes, not recreated each time.
    if (resumePositionSeconds > 0)
    {
        videoElement.addEventListener('loadedmetadata', () =>
        {
            videoElement.currentTime = resumePositionSeconds;
        }, { once: true });
    }

    videoElement.load();

    //autoplay the video
    videoElement.play();

    video_player_section.classList.remove('d-none');

    // Restart the periodic progress-reporting timer for the newly loaded episode - only
    // one timer should ever be running, so the previous episode's timer (if any) is cleared first.
    if (progressUpdateIntervalId !== null)
    {
        clearInterval(progressUpdateIntervalId);
    }
    progressUpdateIntervalId = setInterval(sendWatchProgress, PROGRESS_UPDATE_INTERVAL_SECONDS * 1000);

    // Wires the player's native previous/next track controls (shown by supporting
    // browsers/OS media overlays) to previous/next episode - not just a title update.
    if ('mediaSession' in navigator)
    {
        navigator.mediaSession.metadata = new MediaMetadata({ title });
        navigator.mediaSession.setActionHandler('nexttrack', () => { playNextEpisode(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { playPrevEpisode(); });
    }
}

// Auto-advance to the next episode once the current one finishes playing.
screen_video.addEventListener('ended', () => { playNextEpisode(); });

// Reports the position immediately whenever playback is paused, in addition to the
// periodic timer started in updateVideoPlayer.
screen_video.addEventListener('pause', () => { sendWatchProgress(); });

// A content card click always shows details - playback only ever starts once an
// episode/play/resume button is actually pressed from within the details view.
async function click_on_content_item(ContentID)
{
    dismissContinueWatchingButton();

    // Falls back to All_Content_Items in case this content isn't part of whatever
    // filtered subset the grid currently happens to be showing.
    active_content = Content_Items.find(content => content.id === ContentID)
        ?? (All_Content_Items ? All_Content_Items.find(content => content.id === ContentID) : undefined);
    if (!active_content)
    {
        console.error("Failed to find content");
        return;
    }

    Current_Last_Watched_View = 'details';

    // Whatever was playing (this content or another one) stops entirely before
    // details for the newly clicked content are shown.
    await stopPlayback();

    UI.GoToLink("#");
    await randerContentItems(active_content);
}

async function refreshDisplay()
{
    await renderAllContentItems(Content_Items.filter(item => item.title.toLowerCase().includes(User_Search_Value.toLowerCase())));
}

// Pinned "continue watching" button, shown only on first page entry. It resumes the most
// recent last-watched episode from its saved position. It's dismissed only when the user
// opens a specific content's details (which has its own Resume button).
function renderContinueWatchingButton()
{
    if (!activeProfile || !Array.isArray(activeProfile.lastWatched) || activeProfile.lastWatched.length === 0) return;
    if (document.getElementById('continue_watching_pinned')) return;

    // lastWatched is newest-first (the server unshifts new entries to the front), so index 0 is the most recent.
    const lastEntry = activeProfile.lastWatched[0];
    const content = All_Content_Items ? All_Content_Items.find(item => item.id === lastEntry.content_id) : undefined;
    if (!content) return;

    const button = document.createElement('button');
    button.id = 'continue_watching_pinned';
    button.type = 'button';
    button.className = 'btn btn-danger position-fixed top-0 end-0 m-3 shadow';
    button.style.zIndex = '1050';
    button.setAttribute('dir', 'ltr');
    button.textContent = `▶ Continue: ${content.title}`;

    button.addEventListener('click', async () =>
    {
        dismissContinueWatchingButton();
        // Resumes the saved episode + saved position_seconds for this content.
        await startOrResumeContentPlayback(lastEntry.content_id);
    });

    document.body.appendChild(button);
}

function dismissContinueWatchingButton()
{
    const button = document.getElementById('continue_watching_pinned');
    if (button) button.remove();
}

async function init()
{
    if (!await ClientSessionManager.isLoggedIn())
    {
        UI.LockUI(all_content_container);
        last_watched_container.innerHTML = "NOT LOGGED IN";
        UI.GoToLink('/');
        return;
    }

    if (!activeProfileId)
    {
        UI.LockUI(all_content_container);
        last_watched_container.innerHTML = "NO PROFILE SELECTED";
        UI.GoToLink('/html/profiles.html');
        return;
    }

    //get the active profile details
    //this includes the last watched entries and the liked content ids
    const fetchProfileDetails_response = await Backend.fetchProfileDetails(token, activeProfileId);
    if (!fetchProfileDetails_response || !fetchProfileDetails_response.success)
    {
        UI.LockUI(all_content_container);
        all_content_container.innerHTML = "ERROR GETTING ACTIVE PROFILE";
        return;
    }
    activeProfile = Profile.fromJSON(fetchProfileDetails_response.profile);

    const getAllContent_response = await Backend.getAllContentItems();
    if (!getAllContent_response || !getAllContent_response.success)
    {
        UI.LockUI(all_content_container);
        all_content_container.innerHTML = "ERROR GETTING CONTENT ITEMS";
        return;
    }
    // All_Content_Items is the permanent full-catalog reference; Content_Items will get
    // reassigned to filtered subsets as soon as a nav link (TV Shows/Movies/etc.) is clicked.
    All_Content_Items = getAllContent_response.content;
    Content_Items = All_Content_Items;

    await refreshDisplay();

    // Show recently-watched right away, without waiting for a "My List" click.
    await renderLastWatched();
    renderContinueWatchingButton();

    search_button.addEventListener('click', search_on_click);
    search_input.addEventListener('keypress', (e) => { if (e.key === 'Enter') search_on_click(); });
    randerProfileDetails();
}
window.click_on_content_item = click_on_content_item;
window.handleToggleLike = handleToggleLike;
window.handleSeasonTabClick = handleSeasonTabClick;
window.handleEpisodeSelect = handleEpisodeSelect;
window.handlePlayMovie = handlePlayMovie;
window.handleReviewSubmit = handleReviewSubmit;
window.handleReviewUpdate = handleReviewUpdate;
window.handleReviewDelete = handleReviewDelete;
window.startOrResumeContentPlayback = startOrResumeContentPlayback;
init();