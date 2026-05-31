import { Profile, MediaItem } from './BACKEND_API/backend-interface.js';
import { ClientSessionManager } from './clientSessionManager.js';
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
let Media_Items = null;

async function renderLastWatched() 
{
    

    document.title = `Profile - ${activeProfile.name}`;

    if (profile_image) 
    {
        profile_image.src = `../assets/profiles_images/${activeProfile.imageName}`;
        profile_image.alt = activeProfile.name;
    }

    last_watched_text.textContent = "Last watched: ";
    const lastWatchedItems = activeProfile.LastWatched_Media_IDs
        .map(id => Media_Items.find(m => m.id === id))
        .filter(m => m !== undefined);

    last_watched_container.innerHTML = lastWatchedItems.map(item => 
    {
        const isLiked = activeProfile.wasLiked_Media_IDs.has(item.id);
        
        const cover_imageName = item.coverImageName || 'UNDEFINED.png';
        return `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 movie_item">
                <img src="../assets/covers/${cover_imageName}" class="img-fluid rounded movie_image" alt="${item.name}" onclick="click_on_media_item(${item.id})">
                <div class="movie_name text-center text-truncate px-1">${item.name}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike(${item.id})">
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
        ? Media_Items.filter(item => item.name.toLowerCase().includes(searchValue.toLowerCase()))
        : Media_Items;

    // Prepare a container for the HTML string to minimize DOM reflows
    let htmlContent = '';

    // Build the movie item cards
    filteredData.forEach(item => 
    {
        const isLiked = activeProfile ? activeProfile.wasLiked_Media_IDs.has(item.id) : false;
        const cover_imageName = item.coverImageName || 'UNDEFINED.png';
        htmlContent += `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 movie_item">
                <img src="../assets/covers/${cover_imageName}" 
                     class="img-fluid rounded movie_image" 
                     alt="${item.name}" 
                     onclick="click_on_media_item(${item.id})">
                <div class="movie_name text-center text-truncate px-1">${item.name}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike(${item.id})">
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
async function handleToggleLike(mediaID)
{
    const response = await ClientSessionManager.toggleLike(mediaID);
    if (!response || !response.success)
    {
        console.error("Failed to toggle like");
        return;
    }
}
async function click_on_media_item(mediaID)
{
    const response = await ClientSessionManager.selectMediaItem(mediaID);
    
    if (!response || !response.success) 
    {
        console.error("Failed to select media");
        return;
    }
    activeProfile = response.data;
    await refreshDisplay();
}

async function refreshDisplay() 
{
    await renderLastWatched();
    await renderAllMovies(User_Search_Value);
}

async function init() 
{
    if (!ClientSessionManager.isLoggedIn())
    {
        UI.LockUI(all_movies_container);
        last_watched_container.innerHTML = "NOT LOGGED IN";
        setTimeout(() => UI.GoToLink('/'), 5000);
        return;
    }

    activeProfile = await ClientSessionManager.getActiveProfile();
    if (!activeProfile)
    {
        UI.LockUI(all_movies_container);
        last_watched_container.innerHTML = "NO PROFILE SELECTED";
        setTimeout(() => UI.GoToLink('/html/profiles.html'), 5000);
        return;
    }

    const response = await ClientSessionManager.getAllMediaItems();
    if (!response || !response.success)
    {
        UI.LockUI(all_movies_container);
        all_movies_container.innerHTML = "ERROR GETTING MEDIA ITEMS";
        return;
    }
    Media_Items = response.data.map(item => MediaItem.fromJSON(item));

    await refreshDisplay();
    
    search_button.addEventListener('click', search_on_click);
    search_input.addEventListener('keypress', (e) => { if (e.key === 'Enter') search_on_click(); });
}
window.click_on_media_item = click_on_media_item;
window.handleToggleLike = handleToggleLike;
init();