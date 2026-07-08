import * as Constants from '../constances.js';
import { Interface_BackendAPI, UserInfo, Profile, ContentItem } from './backend-interface.js';

export class HttpClient extends Interface_BackendAPI
{
    /**
     * @param {string} backendURL - Base URL of the backend server, including the /api prefix.
     */
    constructor(backendURL = "http://localhost:3000/api")
    {
        super();
        this.backendURL = backendURL;
    }

    // ==========================================
    //         User Routes (public/self)
    // ==========================================

    async register(email, phone, password, fullName, birthday)
    {
        return await this._request('POST', '/user/register', { body: { email, phone, password, fullName, birthday } });
    }

    async login(email_or_phone, password)
    {
        return await this._request('POST', '/user/login', { body: { email_or_phone, password } });
    }

    async logout(sessionToken)
    {
        return await this._request('POST', '/user/logout', { token: sessionToken });
    }

    async fetchActiveUserInfo(sessionToken)
    {
        const result = await this._request('GET', '/user/me', { token: sessionToken });
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    // `changes` can include password/email/phone/fullName/birthday - all optional
    async updateActiveUserInfo(sessionToken, changes)
    {
        const result = await this._request('PUT', '/user/me', { token: sessionToken, body: changes });
        // backend returns `user` on most failures too (pre-change data), not just on success
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    // ==========================================
    //         User Routes (admin only)
    // ==========================================

    // sortOrder is "greater_to_smaller" / "smaller_to_greater" only (same scheme as content search below)
    async searchUsers(sessionToken, queryParams = {})
    {
        const result = await this._request('GET', '/user/', { token: sessionToken, query: queryParams });
        return { ...result, users: (result.users ?? []).map(u => UserInfo.fromJSON(u)) };
    }

    async fetchUserById(sessionToken, userId)
    {
        const result = await this._request('GET', `/user/${userId}`, { token: sessionToken });
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    async updateUserById(sessionToken, userId, changes)
    {
        const result = await this._request('PUT', `/user/${userId}`, { token: sessionToken, body: changes });
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    async deleteUser(sessionToken, userId)
    {
        return await this._request('DELETE', `/user/${userId}`, { token: sessionToken });
    }

    // permission_level goes in the request body (not a query param, despite the route name)
    async setUserPermissionLevel(sessionToken, userId, permissionLevel)
    {
        return await this._request('PUT', `/user/${userId}/permission`, { token: sessionToken, body: { permission_level: permissionLevel } });
    }

    // ==========================================
    //              Profile Routes
    // ==========================================

    async createProfile(sessionToken)
    {
        const result = await this._request('POST', '/profile/', { token: sessionToken });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    async fetchAllProfiles(sessionToken)
    {
        const result = await this._request('GET', '/profile/', { token: sessionToken });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    async fetchProfileById(sessionToken, profileId)
    {
        const result = await this._request('GET', `/profile/${profileId}`, { token: sessionToken });
        return { ...result, profile: result.profile ? Profile.fromJSON(result.profile) : undefined };
    }

    async fetchProfileDetails(sessionToken, profileId)
    {
        const result = await this._request('GET', `/profile/${profileId}/details`, { token: sessionToken });
        return { ...result, profile: result.profile ? Profile.fromJSON(result.profile) : undefined };
    }

    async updateProfile(sessionToken, profileId, changes)
    {
        const result = await this._request('PUT', `/profile/${profileId}`, { token: sessionToken, body: changes });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    // Profile.toJSON() no longer includes `id` (removed to match PUT /profile/:profileId body),
    // so it has to be re-attached here for the bulk "updates" array which needs profileId per item
    async saveProfiles(sessionToken, profiles)
    {
        const updates = profiles.map(p => ({
            profileId: p.id,
            ...(p.toJSON ? p.toJSON() : p)
        }));
        const result = await this._request('PUT', '/profile/', { token: sessionToken, body: { updates } });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    async deleteProfile(sessionToken, profileId)
    {
        const result = await this._request('DELETE', `/profile/${profileId}`, { token: sessionToken });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    async toggleContentLike(sessionToken, profileID, contentID)
    {
        return await this._request('POST', `/profile/${profileID}/likes/${contentID}`, { token: sessionToken });
    }

    async selectContentItem(sessionToken, profileID, contentID)
    {
        return await this._request('POST', `/profile/${profileID}/watch/${contentID}`, { token: sessionToken });
    }

    // ==========================================
    //         Content Routes (public)
    // ==========================================

    async getContentByID(contentID)
    {
        const result = await this._request('GET', `/content/${contentID}`);
        return { ...result, content: result.content ? ContentItem.fromJSON(result.content) : undefined };
    }

    // sortOrder uses the same scheme as searchUsers() above
    async getAllContentItems(queryParams = {})
    {
        const result = await this._request('GET', '/content/', { query: queryParams });
        return { ...result, content: (result.content ?? []).map(c => ContentItem.fromJSON(c)) };
    }

    // ==========================================
    //         Content Routes (admin only)
    // ==========================================

    async createContent(sessionToken, contentData)
    {
        const result = await this._request('POST', '/content/', { token: sessionToken, body: contentData });
        return { ...result, content: result.content ? ContentItem.fromJSON(result.content) : undefined };
    }

    async updateContent(sessionToken, contentID, changes)
    {
        const result = await this._request('PUT', `/content/${contentID}`, { token: sessionToken, body: changes });
        return { ...result, content: result.content ? ContentItem.fromJSON(result.content) : undefined };
    }

    async deleteContent(sessionToken, contentID)
    {
        return await this._request('DELETE', `/content/${contentID}`, { token: sessionToken });
    }

    // ==========================================
    //              Internal helper
    // ==========================================

    /**
     * Generic request helper for all endpoints.
     * @param {string} method - GET | POST | PUT | DELETE
     * @param {string} path - route path starting with '/', e.g. '/user/me'
     * @param {{ token?: string, query?: Object, body?: Object }} [options]
     */
    async _request(method, path, { token, query, body } = {})
    {
        try
        {
            const url = new URL(`${this.backendURL}${path}`);
            if (query)
            {
                // skip undefined/null so we don't send "?limit=undefined" etc.
                Object.entries(query).forEach(([key, value]) =>
                {
                    if (value !== undefined && value !== null) url.searchParams.append(key, value);
                });
            }

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(url.toString(),
            {
                method,
                headers,
                // GET/DELETE never need a body on this API
                body: (method !== 'GET' && method !== 'DELETE' && body) ? JSON.stringify(body) : undefined
            });

            // The backend always responds 200 with { success:false, ... } on business errors,
            // so a non-ok status here means something unexpected (network/routing/crash).
            if (!response.ok)
            {
                return { success: false, message: `HTTP error! status: ${response.status}` };
            }

            return await response.json();
        }
        catch (error)
        {
            return { success: false, message: error.message };
        }
    }
}