//i know this code is can be reused for other pages but i dont have time to refactor it , sorry for that.
import { Profile, ContentItem } from './BACKEND_API/backend-interface.js';
import { Backend } from './config.js';
import { ClientSessionManager } from './client-session-manager.js';
import * as Constants from './constances.js';
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

let User_Search_Value = '';
let activeProfile = null;
let Content_Items = null;
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
async function randerContentItems(content_item)
{
    const response = await Backend.getContentByID(content_item.id);
    if (!response || !response.success)
    {
        console.error("Failed to get content item: ", response.message || "Unknown error");
        return;
    }
    else
    {
        content_item = ContentItem.fromJSON(response.content);
    }
    last_watched_text.textContent = escapeHtml(content_item.title);
    last_watched_container.innerHTML = "";
    const contentHtml = `
    <div class="w-100 p-4">
        ${renderField("ID", escapeHtml(content_item.id))}
        ${renderField("Cover Image Name", escapeHtml(content_item.cover_image_name))}
        ${renderField("Likes", escapeHtml(content_item.likes))}
        ${renderField("Type", escapeHtml(content_item.type))}
        ${renderField("Categories", escapeHtml(content_item.categories.join(", ")))}
        ${renderField("Description", escapeHtml(content_item.description))}
        ${renderField("Age Limit", escapeHtml(content_item.age_limit))}
        ${renderField("Video URL", escapeHtml(content_item.videoUrl))}
        ${renderField("Release Date", escapeHtml(content_item.release_date.toLocaleDateString()))}
        ${renderField("Created At", escapeHtml(content_item.createdAt.toLocaleDateString()))}
        ${renderField("IMDB Rating", escapeHtml(String(content_item.imdb_rating) || "N/A"))}
    </div>
    `;
    last_watched_container.innerHTML = contentHtml;
}

function randerProfileDetails()
{
    if(!activeProfile)return;
    document.title = `Profile - ${activeProfile.profileName}`;

    if (profile_image) 
    {
        profile_image.src = `../assets/profiles_images/${activeProfile.ImageName}`;
        profile_image.alt = activeProfile.profileName;
    }
}

async function renderLastWatched() 
{
    


    last_watched_text.textContent = "Last watched: ";
    const lastWatchedItems = activeProfile.lastWatchedContentIds
        .map(id => Content_Items.find(m => m.id === id))
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


async function home_link_on_click()
{
    const response = await Backend.getContentOthersEngagedWith (token , activeProfile.id);
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
    const response = await Backend.getAllContentItems({ type: "series"  , limit: 100 });
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
    const response = await Backend.getAllContentItems({ type: "movie"  , limit: 100 });
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

async function new_and_popular_link_on_click()
{
    let current_date = new Date();
    const response = await Backend.getAllContentItems({  released_before: current_date , sort_order: "greater_to_smaller" , limit: 100 });
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
        activeProfile.update_wasLiked_Content_IDs(updated_likedContentIds);
        let pressed_content = Content_Items.find(content => content.id === ContentID);
        if (pressed_content)
        {
            if(response.liked)
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
}

async function click_on_content_item(ContentID)
{
    const response = await Backend.selectContentItem(token, activeProfileId, ContentID);
    
    if (!response || !response.success) 
    {
        console.error("Failed to select content: ", response.message || "Unknown error");
        return;
    }
    else
    {
        if(!response.lastWatchedContentIds)
        {
            console.error("Failed to get last watched content ids: ", response.message || "Unknown error");
            return;
        }
        const updated_lastWatchedContentIds = response.lastWatchedContentIds;
        activeProfile.update_LastWatched_Content_IDs(updated_lastWatchedContentIds);
        active_content = Content_Items.find(content => content.id === ContentID);
        if (active_content)
        {
            UI.GoToLink("#");
            updateVideoPlayer(active_content.videoUrl, active_content.title);
            randerContentItems(active_content);
        }
        else
        {
            console.error("Failed to find content");
        }
    }
    await refreshDisplay();
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
    //this is include the last watched contents ids and the wasLiked contents ids
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
init();