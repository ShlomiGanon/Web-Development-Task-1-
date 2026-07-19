import { Backend } from '../constants.js';
const COOKIE_SESSION_KEY = "session_token";
const STORAGE_PROFILE_KEY = "profile_id";
export class ClientSessionManager
{
    /**
     * Checks whether there's a valid, currently-authenticated session.
     * Verifies the token against the backend (not just its presence).
     * @returns {Promise<boolean>}
     */
    static async isLoggedIn(validateToken = true)
    {
        const token = ClientSessionManager.getSessionToken();

        if (!token)
        {
            return false;
        }
        else if(!validateToken)
        {
            //if we don't want to validate the token, return true because we have token and we dont want to check if it's valid
            return true;
        }

        const userResponse = await Backend.fetchActiveUserInfo(token); // verify the token is valid
        if (userResponse.success)
        {
            return true;
        }
        else
        {
            ClientSessionManager.deleteSessionToken(); // token is invalid/expired - clear it
            return false;
        }
    }

    /**
     * Stores the session token, replacing any previous one.
     * @param {string} sessionToken
     * @param {boolean} rememberMe - if true, persists in a 30-day cookie; otherwise sessionStorage only.
     */
    static setSessionToken(sessionToken, rememberMe)
    {
        ClientSessionManager.deleteSessionToken(); // clear any existing session token first

        if (rememberMe)
        {
            setCookie(COOKIE_SESSION_KEY, sessionToken, 30);
        }
        else
        {
            sessionStorage.setItem(COOKIE_SESSION_KEY, sessionToken);
        }
    }

    /**
     * @returns {string|null} the current session token, from cookie first, then sessionStorage.
     */
    static getSessionToken()
    {
        const cookie = getCookie(COOKIE_SESSION_KEY);
        if (cookie)
        {
            return cookie;
        }
        else
        {
            return sessionStorage.getItem(COOKIE_SESSION_KEY);
        }
    }

    static deleteSessionToken()
    {
        deleteCookie(COOKIE_SESSION_KEY);
        sessionStorage.removeItem(COOKIE_SESSION_KEY);
    }

    /**
     * Stores the active profile ID for the current tab/session only.
     * Intentionally uses sessionStorage (not a cookie / localStorage) so the
     * profile selection is forgotten once the browser tab/window is closed,
     * forcing the user to pick a profile again next time.
     * @param {string} profileId
     */
    static setActiveProfileId(profileId)
    {
        sessionStorage.setItem(STORAGE_PROFILE_KEY, profileId);
    }

    /**
     * @returns {string|null} the active profile ID for this tab/session, or null if none was chosen.
     */
    static getActiveProfileId()
    {
        return sessionStorage.getItem(STORAGE_PROFILE_KEY);
    }

    /**
     * Clears the active profile selection (e.g. on logout or "switch profile").
     */
    static deleteActiveProfileId()
    {
        sessionStorage.removeItem(STORAGE_PROFILE_KEY);
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
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
}

function deleteCookie(name)
{
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}