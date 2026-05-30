// File: js/clientSessionManager.js

import { Backend } from './config.js';
import { Profile } from './BACKEND_API/backend-interface.js';
import * as UI from './ui-utils.js';
const COOKIE_SESSION_KEY = "current_logged_in_user";
const STORAGE_PROFILE_KEY = "active_profile_id";

export class ClientSessionManager 
{

    static isLoggedIn()
    {
        return getCookie(COOKIE_SESSION_KEY) !== null;
    }

    static getSessionToken() 
    {
        return getCookie(COOKIE_SESSION_KEY);
    }

    // ==========================================
    //       Authentication Operations
    // ==========================================

    static async loginByEmail(email, password, rememberMe) 
    {
        const response = await Backend.attemptLoginByEmail(email, password);
        if (response.success) 
        {
            setCookie(COOKIE_SESSION_KEY, response.sessionToken, rememberMe ? 30 : null);
        }
        return response;
    }

    static async loginByPhone(phone, password, rememberMe) 
    {
        const response = await Backend.attemptLoginByPhone(phone, password);
        if (response.success) 
        {
            setCookie(COOKIE_SESSION_KEY, response.sessionToken, rememberMe ? 30 : null);
        }
        return response;
    }

    static async register(email, phone, password, full_name) 
    {
        return await Backend.register(email, phone, password, full_name);
    }

    static async logout() 
    {
        const token = ClientSessionManager.getSessionToken();
        if (token)
        {
            try 
            {
                await Backend.logout(token);
            }
            catch (e)
            {
                console.error("Failed to cleanly logout from backend:", e);
                return { success: false, message: e.message };
            }
        }
        deleteCookie(COOKIE_SESSION_KEY);
        sessionStorage.removeItem(STORAGE_PROFILE_KEY);
        return { success: true };
    }

    static async restoreActiveSession() 
    {
        const token = ClientSessionManager.getSessionToken();
        if (!token) 
        {
            return null;
        }
        
        const response = await Backend.fetchActiveUserInfo(token);
        return response.success ? response.data : null;
    }

    // ==========================================
    //       Profile Operations
    // ==========================================

    static async selectProfile(profileID) 
    {
        const token = ClientSessionManager.getSessionToken();
        if (!token) 
        {
            return { success: false, message: "Not logged in." };
        }

        const userResponse = await Backend.fetchActiveUserInfo(token);
        if (!userResponse.success) 
        {
            return userResponse;
        }

        const profiles = userResponse.data?.profiles || [];
        const profile = profiles.find(p => p.id === Number(profileID));
        if (!profile) 
        {
            return { success: false, message: "Profile not found." };
        }

        sessionStorage.setItem(STORAGE_PROFILE_KEY, profile.id);
        
        return { success: true, data: Profile.fromJSON(profile.toJSON()) };
    }

    static async getActiveProfile() 
    {
        const activeProfileID = sessionStorage.getItem(STORAGE_PROFILE_KEY);
        if (!activeProfileID) 
        {
            return null;
        }

        const token = ClientSessionManager.getSessionToken();
        if (!token) 
        {
            return null;
        }

        const userResponse = await Backend.fetchActiveUserInfo(token);
        if (!userResponse.success) 
        {
            return null;
        }

        const profile = userResponse.data.profiles.find(p => p.id === Number(activeProfileID));
        return profile ? Profile.fromJSON(profile.toJSON()) : null;
    }

    static async saveProfiles(profilesArray) 
    {
        const token = ClientSessionManager.getSessionToken();
        return await Backend.saveProfiles(token, profilesArray);
    }

    // ==========================================
    //       Media Operations
    // ==========================================

    static async getMediaByID(mediaID) 
    {
        return await Backend.getMediaByID(mediaID);
    }

    static async toggleMediaLike(mediaID) 
    {
        const token = ClientSessionManager.getSessionToken();
        const activeProfileID = sessionStorage.getItem(STORAGE_PROFILE_KEY);
        
        if (!token || !activeProfileID) 
        {
            return { success: false, message: "Missing session or active profile." };
        }

        return await Backend.toggleMediaLike(token, activeProfileID, mediaID);
    }

    static async getAllMediaItems()
    {
        return await Backend.getAllMediaItems();
    }

    static async selectMediaItem(mediaID)
    {
        const token = ClientSessionManager.getSessionToken();
        const profileID = sessionStorage.getItem(STORAGE_PROFILE_KEY);
        
        return await Backend.selectMediaItem(token, profileID, mediaID);
    }
}

// -------------- Isolated Browser Cookie Helpers --------------
function getCookie(name) 
{
    const cookies = document.cookie.split('; ');
    const cookie = cookies.find(row => row.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
}

function setCookie(name, value, days = null) 
{
    let expires = "";
    if (days) 
    {
        const date = new Date();
        // Calculate milliseconds for X days (days * 24 hours * 60 mins * 60 secs * 1000 ms)
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
}

function deleteCookie(name) 
{
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

