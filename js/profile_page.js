import { Profile } from './BACKEND_API/backend-interface.js';
import { ClientSessionManager } from './clientSessionManager.js';
import * as Constants from './constances.js';

const last_watched_container = document.getElementById('last_watched_container');
const last_watched_text = document.getElementById('last_watched_text');
const all_movies_container = document.getElementById('all_movies_container');
const all_movies_text = document.getElementById('all_movies_text');
const search_button = document.getElementById('search_button');
const search_input = document.getElementById('search_input');
const profile_image = document.getElementById('profile_image');

async function renderLastWatched() 
{
    const profile = await ClientSessionManager.getActiveProfile();
    if (!profile) 
    {
        last_watched_text.textContent = "No profile selected";
        return;
    }

    if (profile_image) 
    {
        profile_image.src = `../assets/profiles_images/${profile.imageName}`;
        profile_image.alt = profile.name;
    }

    const response = await ClientSessionManager.getAllMediaItems();
    if (!response || !response.success) return;

    const allMedia = response.data;
    
    last_watched_text.textContent = "Last watched: ";
    const lastWatchedItems = profile.LastWatched_Media_IDs
        .map(id => allMedia.find(m => m.id === Number(id)))
        .filter(m => m !== undefined);

    // שימוש ב-map עם לוגיקת לייק כדי לשמור על עיצוב אחיד
    last_watched_container.innerHTML = lastWatchedItems.map(item => 
    {
        const isLiked = profile.wasLiked_Media_IDs.has(item.id);
        
        return `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 movie_item">
                <img src="../assets/covers/${item.cover_imageName}" class="img-fluid rounded movie_image" alt="${item.name}" onclick="click_on_media_item(${item.id})">
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

async function renderAllMovies(filter = '') 
{
    const response = await ClientSessionManager.getAllMediaItems();
    if (!response || !response.success || !response.data) return;

    const profile = await ClientSessionManager.getActiveProfile();
    
    const filteredData = filter 
        ? response.data.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()))
        : response.data;

    all_movies_container.innerHTML = '';

    filteredData.forEach(item => 
    {
        const isLiked = profile ? profile.wasLiked_Media_IDs.has(item.id) : false;

        all_movies_container.innerHTML += `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-4 movie_item">
                <img src="../assets/covers/${item.cover_imageName}" class="img-fluid rounded movie_image" alt="${item.name}" onclick="click_on_media_item(${item.id})">
                <div class="movie_name text-center text-truncate px-1">${item.name}</div>
                <button class="btn btn-sm ${isLiked ? 'btn-danger' : 'btn-outline-danger'} w-100 mt-2" 
                        onclick="handleToggleLike(${item.id})">
                    ${isLiked ? `${item.likes} 💔(unlike)` : `${item.likes} ❤️(like)`}
                </button>
            </div>
        `;
    });

    if (filteredData.length === 0)
    {
        all_movies_text.textContent = "No movies found";
    }
}

async function search_on_click() 
{
    const search_value = search_input.value.trim();
    
    if (search_value !== '') 
    {
        all_movies_text.textContent = "Search: " + search_value;
        await renderAllMovies(search_value);
    }
    else 
    {
        all_movies_text.textContent = "All movies";
        await renderAllMovies();
    }
    search_input.value = '';
}

async function click_on_media_item(mediaID)
{
    const response = await ClientSessionManager.selectMediaItem(mediaID);
    
    if (!response || !response.success) 
    {
        console.error("Failed to select media");
        return;
    }

    await renderLastWatched();
    await renderAllMovies();
}

renderLastWatched();
renderAllMovies();
search_button.addEventListener('click', search_on_click);
search_input.addEventListener('keypress', (e) => 
{
    if (e.key === 'Enter') search_on_click();
});

window.handleToggleLike = async (mediaID) => 
{
    const response = await ClientSessionManager.toggleMediaLike(mediaID);
    
    if (response && response.success) 
    {
        await renderLastWatched();
        await renderAllMovies(); 
    }
    else
    {
        alert("Failed to update like: " + (response?.message || "Unknown error"));
    }
};

window.click_on_media_item = click_on_media_item;
