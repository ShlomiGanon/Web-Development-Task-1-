import { Profile, ContentItem } from './BACKEND_API/backend-interface.js';
import { Backend } from './config.js';
import { ClientSessionManager } from './client-session-manager.js';
import * as Constants from './constances.js';
import * as UI from './ui-utils.js';

const last_watched_container = document.getElementById('last_watched_container');
const last_watched_text = document.getElementById('last_watched_text');
const all_movies_container = document.getElementById('all_movies_container');
const all_movies_text = document.getElementById('all_movies_text');
const search_button = document.getElementById('search_button');
const search_input = document.getElementById('search_input');
const profile_image = document.getElementById('profile_image');
let User_Search_Value = '';
let activeProfile = null;
let Content_Items = null;
const token = ClientSessionManager.getSessionToken();
const activeProfileId = ClientSessionManager.getActiveProfileId();

async function renderLastWatched() 
{
    

    document.title = `Profile - ${activeProfile.name}`;

    if (profile_image) 
    {
        profile_image.src = `../assets/profiles_images/${activeProfile.imageName}`;
        profile_image.alt = activeProfile.name;
    }

    last_watched_text.textContent = "Last watched: ";
    const lastWatchedItems = activeProfile.LastWatched_Content_IDs
        .map(id => Content_Items.find(m => m.id === id))
        .filter(m => m !== undefined);

    last_watched_container.innerHTML = lastWatchedItems.map(item => 
    {
        const isLiked = activeProfile.wasLiked_Content_IDs.has(item.id);
        
        const cover_imageName = item.cover_imageName || 'UNDEFINED.png';
        return `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 movie_item">
                <img src="../assets/covers/${cover_imageName}" class="img-fluid rounded movie_image" 
                alt="${item.name}" 
                onclick="click_on_content_item('${item.id}')">
                <div class="movie_name text-center text-truncate px-1">${item.name}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike('${item.id}')">
                    ${isLiked ? `${item.likes} 💔(unlike)` : `${item.likes} ❤️(like)`}
                </button>
            </div>
        `;
    }).join('');

    if (lastWatchedItems.length === 0)
    {
        last_watched_text.textContent = "No movies watched";
    }
}

/**
 * Renders all media items to the UI, applying an optional search filter.
 * @param {string} searchValue - The search string to filter movies by name.
 */
async function renderAllMovies(searchValue = '') 
{
    const filteredData = searchValue 
        ? Content_Items.filter(item => item.name.toLowerCase().includes(searchValue.toLowerCase()))
        : Content_Items;

    // Prepare a container for the HTML string to minimize DOM reflows
    let htmlContent = '';

    // Build the movie item cards
    filteredData.forEach(item => 
    {
        const isLiked = activeProfile ? activeProfile.wasLiked_Content_IDs.has(item.id) : false;
        const cover_imageName = item.cover_imageName || 'UNDEFINED.png';
        htmlContent += `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 movie_item">
                <img src="../assets/covers/${cover_imageName}" 
                     class="img-fluid rounded movie_image" 
                     alt="${item.name}" 
                     onclick="click_on_content_item('${item.id}')">
                <div class="movie_name text-center text-truncate px-1">${item.name}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike('${item.id}')">
                    ${isLiked ? `${item.likes} 💔(unlike)` : `${item.likes} ❤️(like)`}
                </button>
            </div>
        `;
    });

    // Update the DOM once with the fully constructed HTML string
    all_movies_container.innerHTML = htmlContent;

    // Handle empty results case
    if (filteredData.length === 0)
    {
        all_movies_container.innerHTML = `<div class="col-12 text-center mt-4"><h1>No movies found</h1></div>`;
    }
}

async function search_on_click() 
{
    const search_value = search_input.value.trim();
    User_Search_Value = search_value;
    if (search_value !== '') 
    {
        all_movies_text.textContent = "Search results for: " + search_value;
        await renderAllMovies(User_Search_Value);
    }
    else 
    {
        all_movies_text.textContent = "All movies: ";
        await renderAllMovies();
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
        const updated_wasLiked_Content_IDs = response.likedContentIds;
        activeProfile.update_wasLiked_Content_IDs(updated_wasLiked_Content_IDs);
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
        const updated_LastWatched_Content_IDs = response.watchHistory;//TODO: change to Content_IDs
        activeProfile.update_LastWatched_Content_IDs(updated_LastWatched_Content_IDs);
    }
    await refreshDisplay();
}

async function refreshDisplay() 
{
    await renderLastWatched();
    await renderAllMovies(User_Search_Value);
}

async function init() 
{
    if (!await ClientSessionManager.isLoggedIn())
    {
        UI.LockUI(all_movies_container);
        last_watched_container.innerHTML = "NOT LOGGED IN";
        setTimeout(() => UI.GoToLink('/'), 5000);
        return;
    }

    if (!activeProfileId)
    {
        UI.LockUI(all_movies_container);
        last_watched_container.innerHTML = "NO PROFILE SELECTED";
        setTimeout(() => UI.GoToLink('/html/profiles.html'), 5000);
        return;
    }

    //get the active profile details
    //this is include the last watched contents ids and the wasLiked contents ids
    const fetchProfileDetails_response = await Backend.fetchProfileDetails(token, activeProfileId);
    if (!fetchProfileDetails_response || !fetchProfileDetails_response.success)
    {
        UI.LockUI(all_movies_container);
        all_movies_container.innerHTML = "ERROR GETTING ACTIVE PROFILE";
        return;
    }
    activeProfile = Profile.fromJSON(fetchProfileDetails_response.profile);
    console.log(activeProfile);

    const getAllContent_response = await Backend.getAllContentItems();
    if (!getAllContent_response || !getAllContent_response.success)
    {
        UI.LockUI(all_movies_container);
        all_movies_container.innerHTML = "ERROR GETTING CONTENT ITEMS";
        return;
    }
    Content_Items = getAllContent_response.content;

    await refreshDisplay();
    
    search_button.addEventListener('click', search_on_click);
    search_input.addEventListener('keypress', (e) => { if (e.key === 'Enter') search_on_click(); });
}
window.click_on_content_item = click_on_content_item;
window.handleToggleLike = handleToggleLike;
init();