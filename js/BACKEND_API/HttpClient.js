import * as Constants from '../constances.js';
import { Interface_BackendAPI, UserInfo, Profile, MediaItem } from './backend-interface.js';

export class HttpClient extends Interface_BackendAPI 
{
    /**
     * Initializes the HttpClient class with the backend URL.
     * @param {string} backendURL - The URL of the backend server.
     */
    constructor(backendURL = "http://localhost:3000") 
    {
        super();
        this.backendURL = backendURL;
    }

    // Step 1A: Email Authentication Attempt
    // Validates credentials via email and, upon success, establishes an isolated, 
    // one-to-one session linkage in the server registry for this specific client.
    async attemptLoginByEmail(email, password) 
    {
        return await this._http_post_request('/email-login', { email: email, password: password });
    }

    // Step 1B: Phone Authentication Attempt
    // Validates credentials via phone number and, upon success, establishes an isolated, 
    // one-to-one session linkage in the server registry for this specific client.
    async attemptLoginByPhone(phone, password) 
    {
        return await this._http_post_request('/phone-login', { phone: phone, password: password });
    }

    // User Registration
    // Creates a new user record in the server storage system with the provided credentials.
    async register(email, phone, password, fullName) 
    {
        return await this._http_post_request('/register', { email: email, phone: phone, password: password, fullName: fullName });
    }

    // Step 2: Secured User Info Fetching
    // Identifies the specific client via their active session token, retrieves their 
    // authorized user from the server registry, and populates a dedicated UserInfo instance.
    async fetchActiveUserInfo(sessionToken) 
    {
        const result = await this._http_post_request('/get-user-info', { sessionToken });
        return { ...result, data: result.success ? UserInfo.fromJSON(result.data) : null };
    }

    // Synchronizes and updates the active user's profiles array on the server.
    async saveProfiles(sessionToken, profiles) 
    {
        const profilesJson = profiles.map(p => p.toJSON ? p.toJSON() : p);
        return await this._http_post_request('/save-profiles', { sessionToken, profiles: profilesJson });
    }

    // Terminates the active session, revokes the server-side connection token, 
    // and purges all client-side session data and cookies.
    async logout(sessionToken) 
    {
        return await this._http_post_request('/logout', { sessionToken: sessionToken });
    }

    // Retrieves a media item by its unique identifier.
    async getMediaByID(mediaID)
    {
        const result = await this._http_post_request('/get-media-by-id', { mediaID });
        return { ...result, data: result.success ? MediaItem.fromJSON(result.data) : null };
    }

    // Toggles a like to a media item. (remove or add a like)
    async toggleMediaLike(sessionToken, profileID, mediaID)
    {
        return await this._http_post_request('/toggle-media-like', { sessionToken: sessionToken, profileID: profileID, mediaID: mediaID });
    }

    // Retrieves all media items.
    async getAllMediaItems()
    {
        const result = await this._http_post_request('/get-all-media-items', {});
        return { 
            ...result, 
            data: result.success ? result.data.map(item => MediaItem.fromJSON(item)) : [] 
        };
    }
    
    // Selects a media item and adds it to the user's LastWatched list.
    async selectMediaItem(sessionToken, profileID, mediaID)
    {
        return await this._http_post_request('/select-media-item', { sessionToken: sessionToken, profileID: profileID, mediaID: mediaID });
    }

    /**
     * Sends a POST request to the backend server.
     * @param {string} endpoint - The endpoint of the backend server.
     * @param {Object} body - The body of the request.
     * @returns {Promise<{success: boolean, data?: any, message?: string}>} The response from the backend server.
     */
    async _http_post_request(endpoint, body) 
    {
        try 
        {
            const response = await fetch(`${this.backendURL}${endpoint}`, 
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok)
            {
                return { success: false, message: `HTTP error! status: ${response.status}` };
            }

            const data = await response.json();
            return { success: true, ...data };
        }
        catch (error) 
        {
            return { success: false, message: error.message };
        }
    }
}