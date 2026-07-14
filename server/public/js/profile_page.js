//i know this code is can be reused for other pages but i dont have time to refactor it , sorry for that.
import { Profile, ContentItem } from './BACKEND_API/backend-interface.js';
import { Backend } from './config.js';
import { ClientSessionManager } from './client-session-manager.js';
import * as UI from './ui-utils.js';

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

let User_Search_Value = '';
let activeProfile = null;
let Content_Items = null;
// Episode picker state - only relevant while viewing a "series" content item's details.
let Current_Series_Content_Id = null;
let Current_Series_Seasons = null; // Array<Array<Episode>> - seasons[0] = season 1, etc.
let Current_Selected_Season = 1;
// Reviews state - tracks whichever content/episode is currently playing, so the reviews
// section always reflects the episode actually on screen (movie's single episode, or
// whichever series episode was just selected/resumed).
let Current_Watching_Content_Id = null;
let Current_Watching_Episode_Id = null;
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

function renderField(label, value, seperator = ':', labelClass = 'text-danger', valueClass = 'text-white')
{
    return `
    <div class="label_item border border-white rounded-pill p-2 w-100 m-2" dir="ltr"
         style="display: grid; grid-template-columns: 5fr 1fr 6fr; align-items: center; column-gap: 0.5rem;">
        <div class="text-center ${labelClass} fw-bold fs-4" style="overflow-wrap: break-word; word-break: break-word;">${label}</div>
        <div class="text-center text-warning fw-bold fs-4">${seperator}</div>
        <div class="text-center ${valueClass} fs-5" style="overflow-wrap: break-word; word-break: break-word;">${value}</div>
    </div>
`;
}

// Renders every field present on the raw content object returned by the server, generically -
// so nothing is hand-picked/omitted here, and any field the backend adds or removes later
// (e.g. imdb_rating only being present sometimes) is reflected automatically.
function formatContentFieldValue(value)
{
    if (value === null || value === undefined) return "N/A";
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "N/A";
    return String(value);
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

    last_watched_text.textContent = escapeHtml(content_item.title);
    last_watched_container.innerHTML = "";
    const fieldsHtml = Object.entries(rawContent)
        .map(([key, value]) => renderField(escapeHtml(key), escapeHtml(formatContentFieldValue(value))))
        .join('');
    const contentHtml = `
    <div class="w-100 p-4">
        ${fieldsHtml}
    </div>
    `;
    last_watched_container.innerHTML = contentHtml;

    // Only series have episodes to pick from. Movies are a single Episode under the hood
    // (season 1, episode 1), but there's nothing to "pick" - just one video to start -
    // so a plain "play movie" button is shown instead of an episode list.
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
        <div class="w-100 p-4 text-center" dir="rtl">
            <button type="button" class="btn btn-danger btn-lg" onclick="handlePlayMovie('${contentId}')">
                ▶ הפעל סרט
            </button>
        </div>
    `;
    last_watched_container.insertAdjacentHTML('beforeend', playButtonHtml);
}

// Resumes this content's saved episode if the profile already has watch progress for it,
// otherwise starts from season 1 / episode 1 (the resume-or-default watch endpoint handles
// both cases). Used both by the movie "play" button and by auto-resume on a content card
// click when watch history already exists for that content.
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
    await onEpisodePlaybackStarted(contentId, response.episode);
    await refreshDisplay();
}

// Starts the movie's video (there's only ever one episode for a movie - season 1,
// episode 1 - so the resume-or-default watch endpoint is exactly what's needed here,
// same as it would be for a series with no saved progress yet).
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

    // Default to whichever season contains the episode currently playing (if this content
    // is the one already being watched), so the "now playing" highlight is visible right
    // away instead of always resetting to season 1.
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
        <div class="episode_picker w-100 p-4" dir="rtl">
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
                    עונה ${seasonNumber}
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
                פרק ${ep.episodeNumber} - ${escapeHtml(ep.title)}
            </button>
        </div>
    `;
    }).join('');

    if (episodes.length === 0)
    {
        episodeListContainer.innerHTML = `<div class="col-12 text-center" dir="rtl">לא נמצאו פרקים לעונה זו</div>`;
    }
}

function handleSeasonTabClick(seasonNumber)
{
    Current_Selected_Season = seasonNumber;
    renderSeasonTabs();
    renderEpisodeList(seasonNumber);
}

// Shared "an episode just started playing" bookkeeping used by every path that starts
// playback (manual episode pick, resume/default watch, auto-advance on 'ended', and the
// player's next/previous track buttons): updates the tracking vars, keeps the season-tabs
// picker in sync (jumping to the right season, refreshing the "now playing" highlight),
// and refreshes the reviews section for the new episode.
async function onEpisodePlaybackStarted(contentId, episode)
{
    Current_Watching_Content_Id = contentId;
    Current_Watching_Episode_Id = episode.id;

    UI.GoToLink("#");
    updateVideoPlayer(episode.videoUrl, episode.title);

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
    await onEpisodePlaybackStarted(contentId, response.episode);
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

// Auto-advance: called when the video ends, and by the player's "next" control.
// No-ops quietly if there's nothing currently playing, or if this was the last episode
// (series finale) / the only episode (movie) - getNextEpisode simply omits `episode`.
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

// Fetches all reviews for the given episode and renders both the reviews list and the
// add/edit form. If the current profile already reviewed this episode, the form switches
// to edit/delete mode instead of add mode (a profile can only review an episode once).
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
            <div class="review_form border border-secondary rounded p-3 mb-3" dir="rtl">
                <h5 class="text-white">עריכת התגובה שלך</h5>
                <div class="mb-2">
                    <h4 class="text-white">ציון (1-10)</h4>
                    <input type="number" id="review_rating_input" class="form-control" min="1" max="10" value="${escapeHtml(ownReview.rating)}">
                </div>
                <div class="mb-2">
                    <h4 class="text-white">תגובה</h4>
                    <textarea id="review_comment_input" class="form-control" maxlength="500" rows="3">${escapeHtml(ownReview.comment ?? '')}</textarea>
                </div>
                <button type="button" class="btn btn-warning me-2" onclick="handleReviewUpdate()">עדכן</button>
                <button type="button" class="btn btn-outline-danger" onclick="handleReviewDelete()">מחק תגובה</button>
            </div>
        `;
    }
    else
    {
        review_form_container.innerHTML = `
            <div class="review_form border border-secondary rounded p-3 mb-3" dir="rtl">
                <h5 class="text-white">כתיבת תגובה חדשה</h5>
                <div class="mb-2">
                    <h4 class="text-white">ציון (1-10)</h4>
                    <input type="number" id="review_rating_input" class="form-control" min="1" max="10" value="10">
                </div>
                <div class="mb-2">
                    <h4 class="text-white">תגובה (אופציונלי)</h4>
                    <textarea id="review_comment_input" class="form-control" maxlength="500" rows="3"></textarea>
                </div>
                <button type="button" class="btn btn-danger" onclick="handleReviewSubmit()">שלח תגובה</button>
            </div>
        `;
    }
}

// NOTE: no endpoint returns a profile's display name alongside a review (reviews only
// carry profileId), so there is deliberately no author name shown here - only rating and
// comment, with the current profile's own review labeled inline since we already know its id.
function renderReviewsList(reviews, ownReview)
{
    if (!reviews_list_container) return;

    if (reviews.length === 0)
    {
        reviews_list_container.innerHTML = `<div class="col-12 text-center text-white" dir="rtl">אין עדיין תגובות לפרק הזה</div>`;
        return;
    }

    reviews_list_container.innerHTML = reviews.map(review => `
        <div class="col-12">
            <div class="border border-secondary rounded p-3 text-white" dir="rtl">
                <div class="fw-bold text-warning">
                    ${escapeHtml(review.rating)}/10 ${ownReview && review.id === ownReview.id ? '(התגובה שלך)' : ''}
                </div>
                <div>${escapeHtml(review.comment || '')}</div>
            </div>
        </div>
    `).join('');
}

// Re-fetches and re-renders the content details view (see randerContentItems) so that
// average_rating/review_count shown there reflect the review change that was just made.
// Only relevant if the details currently on screen belong to the content being reviewed.
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

// NOTE: activeProfile.lastWatched is an array of { episode_id, content_id } entries -
// one per content the profile has ever watched (holding the last episode watched within
// that content) - NOT a flat array of content ids. We map by entry.content_id here.
async function renderLastWatched()
{
    last_watched_text.textContent = "Last watched: ";
    const lastWatchedItems = activeProfile.lastWatched
        .map(entry => Content_Items.find(m => m.id === entry.content_id))
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

// NOTE: query params fixed - the API uses `sort` (which field to sort by) + `sortOrder`
// (only "greater_to_smaller" / "smaller_to_greater" - not "sort_order" / "desc"), and
// `released_before` expects a string, not a raw Date object.
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
        //update the content item likes 
        const updated_likedContentIds = response.likedContentIds;
        activeProfile.updateLikedContentIds(updated_likedContentIds);
        let pressed_content = Content_Items.find(content => content.id === ContentID);
        if (pressed_content)
        {
            if (response.liked)
            {
                pressed_content.likes++;
            }
            else
            {
                pressed_content.likes--;
            }
        }
        else
        {
            console.error("Failed to find content");
        }
        await refreshDisplay();
    }
}

// Shown only once something is actually playing - video_player_section starts hidden
// (class "d-none" in the HTML) until the first call here.
function updateVideoPlayer(videoUrl, title)
{
    const videoElement = document.getElementById('screen_video');
    const sourceElement = document.getElementById('screen_video_source');
    const titleElement = document.getElementById('screen_title');

    titleElement.textContent = title;
    sourceElement.setAttribute('src', '/assets/videos/' + videoUrl);

    videoElement.load();

    //autoplay the video
    videoElement.play();

    video_player_section.classList.remove('d-none');

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

// Clicking a content card no longer plays anything by itself - it only shows that
// content's details, which in turn shows either the episode picker (series) or a
// "play movie" button (movie). Actual playback only starts once the person picks a
// specific episode or presses the play button.
async function click_on_content_item(ContentID)
{
    active_content = Content_Items.find(content => content.id === ContentID);
    if (!active_content)
    {
        console.error("Failed to find content");
        return;
    }

    // Clicking a content card always hides the player and reviews again, even if an
    // episode was actively playing - both only reappear once the person explicitly
    // picks an episode / presses "play movie" again from the details view shown below.
    screen_video.pause();
    video_player_section.classList.add('d-none');
    reviews_section.classList.add('d-none');

    UI.GoToLink("#");
    await randerContentItems(active_content);

    // If this profile already watched something from this content before, resume it
    // automatically instead of waiting for another click (episode pick / play button).
    const hasWatchHistory = activeProfile.lastWatched.some(entry => entry.content_id === ContentID);
    if (hasWatchHistory)
    {
        await startOrResumeContentPlayback(ContentID);
    }
}

async function refreshDisplay()
{
    await renderAllContentItems(Content_Items.filter(item => item.title.toLowerCase().includes(User_Search_Value.toLowerCase())));
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
    Content_Items = getAllContent_response.content;

    await refreshDisplay();

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
init();