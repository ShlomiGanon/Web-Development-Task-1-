import * as Constants from '../constances.js';
import { Interface_BackendAPI, UserInfo, Profile, ContentItem, Episode, Review } from './backend-interface.js';

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
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    // ==========================================
    //   Admin Routes - Users (/api/admin/users)
    // ==========================================

    // sortOrder is "greater_to_smaller" / "smaller_to_greater" only (same scheme as content/review search)
    async searchUsers(sessionToken, queryParams = {})
    {
        const result = await this._request('GET', '/admin/users', { token: sessionToken, query: queryParams });
        return { ...result, users: (result.users ?? []).map(u => UserInfo.fromJSON(u)) };
    }

    async fetchUserById(sessionToken, userId)
    {
        const result = await this._request('GET', `/admin/users/${userId}`, { token: sessionToken });
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    async updateUserById(sessionToken, userId, changes)
    {
        const result = await this._request('PUT', `/admin/users/${userId}`, { token: sessionToken, body: changes });
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
    }

    // super admin only - cascades to that user's profiles and reviews
    async deleteUser(sessionToken, userId)
    {
        return await this._request('DELETE', `/admin/users/${userId}`, { token: sessionToken });
    }

    // permission_level: 0=USER, 1=ADMIN, 2=SUPER_ADMIN - goes in the request body
    async setUserPermissionLevel(sessionToken, userId, permissionLevel)
    {
        return await this._request('PUT', `/admin/users/${userId}/permission`, { token: sessionToken, body: { permission_level: permissionLevel } });
    }

    // response is only { success, tokens_count } - no `message` field
    async getUserTokensCount(sessionToken, userId)
    {
        return await this._request('GET', `/admin/users/${userId}/tokens_count`, { token: sessionToken });
    }

    // invalidates all of a user's active tokens. response is only { success }
    async kickUser(sessionToken, userId)
    {
        return await this._request('POST', `/admin/users/${userId}/kick`, { token: sessionToken });
    }

    // does NOT kick existing sessions - call kickUser() separately if needed. response is only { success }
    async banUser(sessionToken, userId, hoursToBan)
    {
        return await this._request('POST', `/admin/users/${userId}/ban`, { token: sessionToken, body: { hours_to_ban: hoursToBan } });
    }

    // response is only { success, is_banned }
    async isUserBanned(sessionToken, userId)
    {
        return await this._request('GET', `/admin/users/${userId}/ban`, { token: sessionToken });
    }

    // NOTE: not yet implemented on the server - see admin-find-user-by-profile.js for the
    // controller code to integrate, plus a route to add in the admin routes file.
    // Finds the user that owns a given profile ID (admin only) - there is no regular
    // /api/profile/* route for this since those are scoped to the logged-in user's own
    // profiles only.
    async findUserByProfileId(sessionToken, profileId)
    {
        const result = await this._request('GET', `/admin/profiles/${profileId}/owner`, { token: sessionToken });
        return { ...result, user: result.user ? UserInfo.fromJSON(result.user) : undefined };
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

    // lightweight summary only: { id, profileName, age, ImageName } - no watch history / likes
    async fetchProfileById(sessionToken, profileId)
    {
        const result = await this._request('GET', `/profile/${profileId}`, { token: sessionToken });
        return { ...result, profile: result.profile ? Profile.fromJSON(result.profile) : undefined };
    }

    // full profile document, including likedContentIds and lastWatched
    async fetchProfileDetails(sessionToken, profileId)
    {
        const result = await this._request('GET', `/profile/${profileId}/details`, { token: sessionToken });
        return { ...result, profile: result.profile ? Profile.fromJSON(result.profile) : undefined };
    }

    // returns the caller's FULL updated profile list, not just the one changed profile
    async updateProfile(sessionToken, profileId, changes)
    {
        const result = await this._request('PUT', `/profile/${profileId}`, { token: sessionToken, body: changes });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    /**
     * Bulk-updates several profiles at once.
     * Accepts either plain update objects ({ profileId, profileName?, age?, ImageName? }) as
     * described by the contract, OR Profile instances (uses their toBulkUpdateEntry()) for
     * convenience/backward-compatibility with older call sites.
     * @param {string} sessionToken
     * @param {Array<Object|Profile>} updates
     */
    async saveProfiles(sessionToken, updates)
    {
        const preparedUpdates = updates.map(p => (p && typeof p.toBulkUpdateEntry === 'function') ? p.toBulkUpdateEntry() : p);
        const result = await this._request('PUT', '/profile/', { token: sessionToken, body: { updates: preparedUpdates } });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    // a user's last remaining profile cannot be deleted
    async deleteProfile(sessionToken, profileId)
    {
        const result = await this._request('DELETE', `/profile/${profileId}`, { token: sessionToken });
        return { ...result, profiles: (result.profiles ?? []).map(p => Profile.fromJSON(p)) };
    }

    // toggles a like (add or remove)
    async toggleContentLike(sessionToken, profileId, contentId)
    {
        return await this._request('POST', `/profile/${profileId}/likes/${contentId}`, { token: sessionToken });
    }

    // resumes from the profile's saved episode for this content, or starts at S1E1 otherwise
    async recordWatch(sessionToken, profileId, contentId)
    {
        const result = await this._request('POST', `/profile/${profileId}/watch/${contentId}`, { token: sessionToken });
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // records this specific episode as watched instead of resuming/defaulting
    async recordWatchEpisode(sessionToken, profileId, contentId, episodeId)
    {
        const result = await this._request('POST', `/profile/${profileId}/watch/${contentId}/${episodeId}`, { token: sessionToken });
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // content the user's OTHER profiles have watched/liked, excluding this profile's own history
    async getOtherProfilesRecommendations(sessionToken, profileId)
    {
        const result = await this._request('GET', `/profile/${profileId}/other_profiles_recommendations`, { token: sessionToken });
        return { ...result, content: (result.content ?? []).map(c => ContentItem.fromJSON(c)) };
    }

    // up to 3 top-rated items matching this profile's own taste. empty list (not an error) if no history yet
    async getTopPicks(sessionToken, profileId)
    {
        const result = await this._request('GET', `/profile/${profileId}/top_picks`, { token: sessionToken });
        return { ...result, content: (result.content ?? []).map(c => ContentItem.fromJSON(c)) };
    }

    // ==========================================
    //         Content Routes (public)
    // ==========================================

    async getContentByID(contentId)
    {
        const result = await this._request('GET', `/content/${contentId}`);
        return { ...result, content: result.content ? ContentItem.fromJSON(result.content) : undefined };
    }

    // sortOrder uses the same scheme as searchUsers() above
    async getAllContentItems(queryParams = {})
    {
        const result = await this._request('GET', '/content/', { query: queryParams });
        return { ...result, content: (result.content ?? []).map(c => ContentItem.fromJSON(c)) };
    }

    // only works for type "series". seasons[0] is season 1's episodes, seasons[1] is season 2's, etc.
    async getContentEpisodes(contentId)
    {
        const result = await this._request('GET', `/content/${contentId}/episodes`);
        return { ...result, seasons: (result.seasons ?? []).map(season => (season ?? []).map(e => Episode.fromJSON(e))) };
    }

    async getEpisodeById(contentId, episodeId)
    {
        const result = await this._request('GET', `/content/${contentId}/episodes/${episodeId}`);
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // crosses into the next season if this was the last episode of its season. `episode` absent if series finale
    async getNextEpisode(contentId, episodeId)
    {
        const result = await this._request('GET', `/content/${contentId}/episodes/${episodeId}/next`);
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // crosses back into the previous season if this was the first episode of its season. `episode` absent if series premiere
    async getPrevEpisode(contentId, episodeId)
    {
        const result = await this._request('GET', `/content/${contentId}/episodes/${episodeId}/prev`);
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // ==========================================
    //  Admin Routes - Content (/api/admin/content)
    // ==========================================

    async createContent(sessionToken, contentData)
    {
        const result = await this._request('POST', '/admin/content', { token: sessionToken, body: contentData });
        return { ...result, content: result.content ? ContentItem.fromJSON(result.content) : undefined };
    }

    async updateContent(sessionToken, contentId, changes)
    {
        const result = await this._request('PUT', `/admin/content/${contentId}`, { token: sessionToken, body: changes });
        return { ...result, content: result.content ? ContentItem.fromJSON(result.content) : undefined };
    }

    async deleteContent(sessionToken, contentId)
    {
        return await this._request('DELETE', `/admin/content/${contentId}`, { token: sessionToken });
    }

    // adds a new episode to a series. movies cannot have episodes added this way - use setMovieVideo()
    async addEpisode(sessionToken, contentId, episodeData)
    {
        const result = await this._request('POST', `/admin/content/${contentId}/episodes`, { token: sessionToken, body: episodeData });
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // creates/updates the single video for a movie. internally backed by a season-1/episode-1 Episode,
    // but the caller never needs to think about it that way
    async setMovieVideo(sessionToken, contentId, videoUrl)
    {
        const result = await this._request('PUT', `/admin/content/${contentId}/movie-video`, { token: sessionToken, body: { videoUrl } });
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    // not restricted by content type - a movie's single episode can be edited too
    async updateEpisode(sessionToken, contentId, episodeId, changes)
    {
        const result = await this._request('PUT', `/admin/content/${contentId}/episodes/${episodeId}`, { token: sessionToken, body: changes });
        return { ...result, episode: result.episode ? Episode.fromJSON(result.episode) : undefined };
    }

    async deleteEpisode(sessionToken, contentId, episodeId)
    {
        return await this._request('DELETE', `/admin/content/${contentId}/episodes/${episodeId}`, { token: sessionToken });
    }

    // ==========================================
    //           Review Routes (/api/reviews)
    // ==========================================

    // a profile can only review a given episode once. rating: 1-10. comment: 500 char limit.
    // automatically recalculates that content's average_rating and review_count
    async addReview(sessionToken, profileId, contentId, episodeId, rating, comment)
    {
        const result = await this._request('POST', `/reviews/${profileId}/${contentId}/${episodeId}`, { token: sessionToken, body: { rating, comment } });
        return { ...result, review: result.review ? Review.fromJSON(result.review) : undefined };
    }

    // edits this profile's OWN review. editing the rating recalculates that content's average_rating
    async updateReview(sessionToken, profileId, contentId, episodeId, changes)
    {
        const result = await this._request('PUT', `/reviews/${profileId}/${contentId}/${episodeId}`, { token: sessionToken, body: changes });
        return { ...result, review: result.review ? Review.fromJSON(result.review) : undefined };
    }

    // removes this profile's own review. recalculates average_rating and review_count
    async deleteReview(sessionToken, profileId, contentId, episodeId)
    {
        return await this._request('DELETE', `/reviews/${profileId}/${contentId}/${episodeId}`, { token: sessionToken });
    }

    // public, no login needed. filter by episode_id for all reviews of an episode,
    // or by profile_id + episode_id for one profile's review of one episode
    async searchReviews(queryParams = {})
    {
        const result = await this._request('GET', '/reviews/', { query: queryParams });
        return { ...result, reviews: (result.reviews ?? []).map(r => Review.fromJSON(r)) };
    }

    // ==========================================
    //  Admin Routes - Reviews (/api/admin/reviews)
    // ==========================================

    // edits ANY review directly by id, regardless of who wrote it. recalculates average_rating
    async adminUpdateReview(sessionToken, reviewId, changes)
    {
        const result = await this._request('PUT', `/admin/reviews/${reviewId}`, { token: sessionToken, body: changes });
        return { ...result, review: result.review ? Review.fromJSON(result.review) : undefined };
    }

    // deletes ANY review directly by id. recalculates average_rating and review_count
    async adminDeleteReview(sessionToken, reviewId)
    {
        return await this._request('DELETE', `/admin/reviews/${reviewId}`, { token: sessionToken });
    }

    // ==========================================
    //   Backward-compatible aliases (old names)
    // ==========================================
    // Kept so existing call sites written against the old client don't need to change
    // immediately. New code should prefer the contract methods above.

    /** @deprecated use toggleContentLike() - kept as an alias, same signature */
    async toggleLike(sessionToken, profileId, contentId)
    {
        return await this.toggleContentLike(sessionToken, profileId, contentId);
    }

    /** @deprecated use recordWatch() - old name was selectContentItem() */
    async selectContentItem(sessionToken, profileId, contentId)
    {
        return await this.recordWatch(sessionToken, profileId, contentId);
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