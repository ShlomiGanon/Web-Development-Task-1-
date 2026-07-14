import * as Constants from '../constances.js';

// ==========================================
//                 Profile
// ==========================================

export class Profile
{
    /**
     * @param {string} id - Unique identifier as returned by the backend (opaque, do not assume a numeric format).
     * @param {string} profileName - Profile display name.
     * @param {number} [age=0] - Used for content age-gating.
     * @param {string} [ImageName] - Profile image filename.
     * @param {Array<{episode_id: string, content_id: string}>} [lastWatched=[]] - One entry per
     *        content this profile has ever watched, holding the specific episode last watched
     *        within that content (NOT a list of content ids). No `_id` field - the backend
     *        deliberately strips the underlying record id before sending this over the wire.
     * @param {Set<string>|Array<string>} [likedContentIds=[]]
     */
    constructor(id, profileName, age = 0, ImageName, lastWatched = [], likedContentIds = [])
    {
        this.id = id;
        this.profileName = profileName;
        this.age = age;
        this.ImageName = ImageName;
        this.lastWatched = Array.isArray(lastWatched) ? lastWatched : [];

        if (likedContentIds instanceof Set)
        {
            this.likedContentIds = likedContentIds;
        }
        else
        {
            const rawLikeIDs = Array.isArray(likedContentIds) ? likedContentIds : [];
            this.likedContentIds = new Set(rawLikeIDs);
        }
    }

    /**
     * Builds a Profile from a raw backend response object.
     *
     * UPDATED for the current API:
     * - The lightweight profile summary - returned by createProfile, deleteProfile,
     *   updateProfile, saveProfiles, fetchAllProfiles, and fetchProfileById - is just
     *   { id, profileName, age, ImageName }. No watch history / likes fields at all.
     * - The full profile document (GET /profile/:profileId/details, fetchProfileDetails)
     *   additionally returns:
     *     - likedContentIds: array of content id strings
     *     - lastWatched: array of { episode_id, content_id } - one entry per content ever
     *       watched, holding the last episode watched within that content. The backend
     *       explicitly strips the underlying record's own `_id` before sending this (see
     *       toLastWatchedSummary() on the backend) - do not rely on an `_id` being present
     *       on these entries, in this response or in the POST/watch responses below.
     *   Both fields are already plain/renamed on the wire - there is no raw Mongoose
     *   `LastWatched_Content_IDs`/`Liked_Content_IDs` naming to account for anymore.
     * @param {Object} rawObject
     * @returns {Profile|null}
     */
    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Profile) return rawObject;

        const lastWatched = rawObject.lastWatched ?? [];
        const likedIds = rawObject.likedContentIds ?? [];

        return new Profile(
            rawObject.id,
            rawObject.profileName,
            rawObject.age,
            rawObject.ImageName,
            lastWatched,
            likedIds
        );
    }

    /**
     * Converts back to the shape the backend expects on write - either the body of
     * PUT /profile/:profileId, or one entry inside the `updates` array of PUT /profile/.
     *
     * The backend only ever reads profileName / age / ImageName from these bodies:
     *   - the profile id belongs in the URL path (or the `profileId` key of a bulk update
     *     entry - see toBulkUpdateEntry() below), not in this payload.
     *   - watch history is only ever changed via POST /profile/:profileId/watch/:contentId
     *     (or its .../:episodeId variant).
     *   - likes are only ever changed via POST /profile/:profileId/likes/:contentId.
     */
    toJSON()
    {
        return {
            profileName: this.profileName,
            age: this.age,
            ImageName: this.ImageName
        };
    }

    /**
     * Shape for one entry inside PUT /profile/'s `updates: [...]` array, which needs the
     * profileId alongside the fields being changed.
     */
    toBulkUpdateEntry()
    {
        return {
            profileId: this.id,
            ...this.toJSON()
        };
    }

    updateLastWatched(newLastWatched)
    {
        this.lastWatched = Array.isArray(newLastWatched) ? newLastWatched : [];
    }

    updateLikedContentIds(newLikedContentIds)
    {
        if (newLikedContentIds instanceof Set)
        {
            this.likedContentIds = newLikedContentIds;
        }
        else
        {
            const rawLikeIDs = Array.isArray(newLikedContentIds) ? newLikedContentIds : [];
            this.likedContentIds = new Set(rawLikeIDs);
        }
    }
}

// ==========================================
//                UserInfo
// ==========================================

export class UserInfo
{
    /**
     * Every user endpoint (register aside) returns a "safe user" object shaped exactly as
     * { id, email, phone, fullName, birthday, createdAt, permission_level }.
     *
     * NOTE: no backend endpoint returns a user bundled together with their profiles in one
     * response. GET /user/me and friends return ONLY the fields above - profiles must be
     * fetched separately via the Profile routes (fetchAllProfiles) and merged on the client
     * if a combined view is needed. `rawProfiles` stays empty unless passed in explicitly
     * after a separate call.
     * @param {string} id
     * @param {string} email
     * @param {string} phone
     * @param {string} fullName
     * @param {Date} [birthday]
     * @param {Date} [createdAt]
     * @param {Array<Profile|Object>} [rawProfiles=[]]
     * @param {number} [permission_level]
     */
    constructor(id, email, phone, fullName, birthday, createdAt, rawProfiles = [], permission_level = undefined)
    {
        this.id = id;
        this.email = email;
        this.phone = phone;
        this.fullName = fullName;
        this.birthday = new Date(birthday);
        this.createdAt = new Date(createdAt);
        this.profiles = rawProfiles.map(p => p instanceof Profile ? p : Profile.fromJSON(p));
        this.permission_level = permission_level;
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof UserInfo) return rawObject;
        return new UserInfo(
            rawObject.id,
            rawObject.email,
            rawObject.phone,
            rawObject.fullName,
            new Date(rawObject.birthday),
            new Date(rawObject.createdAt),
            rawObject.profiles,
            rawObject.permission_level
        );
    }

    toJSON()
    {
        return {
            id: this.id,
            email: this.email,
            phone: this.phone,
            fullName: this.fullName,
            birthday: this.birthday.toISOString(),
            createdAt: this.createdAt.toISOString(),
            profiles: this.profiles.map(p => p.toJSON()),
            permission_level: this.permission_level
        };
    }
}

// ==========================================
//               ContentItem
// ==========================================

export class ContentItem
{
    /**
     * UPDATED: `videoUrl` has been removed from ContentItem entirely. Video now lives only
     * on Episodes (see the Episode class below). Use the content/episode routes to fetch
     * playback info.
     *
     * UPDATED: `average_rating` and `review_count` are now included directly on every
     * content object returned by every endpoint (search, single lookup, admin create/update,
     * suggestions, top picks) - previously these existed only on the underlying content
     * document and were never sent to the client. They stay in sync automatically whenever
     * a review is added, edited, or deleted - they are never set directly by the client
     * (see toJSON() below, which deliberately omits them from write payloads).
     *
     * res.content shape (identical across getContentByID / getAllContentItems / admin
     * createContent / admin updateContent / other_profiles_recommendations / top_picks):
        id: string,
        title: string,
        description: string,
        cover_image_name: string,
        type: "movie" | "series",
        categories: string[],
        release_date: string,
        age_limit: number,
        likes: number,
        createdAt: string,
        average_rating: number,
        review_count: number,
        imdb_rating: number   // only ever present on getContentByID's response
     */
    constructor(id, title, cover_image_name, likes = 0, type, categories = [], description, age_limit = 0, release_date, createdAt, imdb_rating = null, average_rating = 0, review_count = 0)
    {
        this.id = id;
        this.title = title;
        this.cover_image_name = cover_image_name;
        this.likes = likes;
        this.type = type;
        this.categories = Array.isArray(categories) ? categories : [];
        this.description = description;
        this.age_limit = age_limit;
        this.release_date = new Date(release_date);
        this.createdAt = new Date(createdAt);
        this.imdb_rating = imdb_rating;
        this.average_rating = average_rating;
        this.review_count = review_count;
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof ContentItem) return rawObject;

        return new ContentItem(
            rawObject.id,
            rawObject.title,
            rawObject.cover_image_name,
            rawObject.likes,
            rawObject.type,
            rawObject.categories,
            rawObject.description,
            rawObject.age_limit,
            rawObject.release_date,
            rawObject.createdAt,
            rawObject.imdb_rating,
            rawObject.average_rating,
            rawObject.review_count
        );
    }

    /**
     * Shape for POST /admin/content and PUT /admin/content/:contentId bodies.
     * average_rating/review_count are deliberately NOT included - they are read-only,
     * server-computed fields (kept in sync via the review endpoints), never something
     * the client sets when creating/updating content.
     */
    toJSON()
    {
        return {
            title: this.title,
            type: this.type,
            release_date: this.release_date instanceof Date ? this.release_date.toISOString() : this.release_date,
            description: this.description,
            cover_image_name: this.cover_image_name,
            categories: this.categories,
            age_limit: this.age_limit
        };
    }
}

// ==========================================
//                 Episode
// ==========================================

export class Episode
{
    /**
     * Every watchable item is an Episode - including a movie's single episode. A movie's
     * episode is still backed by a real Episode entry (season 1, episode 1) under the hood,
     * but it's created/updated through the dedicated movie-video admin endpoint rather than
     * the generic add/update episode endpoints, and callers never need to think about it as
     * "season 1 episode 1" - just as "the movie's video".
     * @param {string} id
     * @param {string} contentId
     * @param {number} seasonNumber
     * @param {number} episodeNumber
     * @param {string} title
     * @param {string} videoUrl
     */
    constructor(id, contentId, seasonNumber, episodeNumber, title, videoUrl)
    {
        this.id = id;
        this.contentId = contentId;
        this.seasonNumber = seasonNumber;
        this.episodeNumber = episodeNumber;
        this.title = title;
        this.videoUrl = videoUrl;
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Episode) return rawObject;

        return new Episode(
            rawObject.id,
            rawObject.contentId,
            rawObject.seasonNumber,
            rawObject.episodeNumber,
            rawObject.title,
            rawObject.videoUrl
        );
    }
}

// ==========================================
//                 Review
// ==========================================

export class Review
{
    /**
     * One profile's rating (1-10) plus an optional comment (500 char limit), for one
     * specific episode. A profile can have at most one review per episode - adding a second
     * is rejected outright by the backend, not merged or overwritten. Adding/editing/deleting
     * a review automatically recalculates that content's average_rating (and review_count,
     * on delete).
     * @param {string} id
     * @param {string} contentId
     * @param {string} episodeId
     * @param {string} profileId
     * @param {number} rating
     * @param {string} [comment]
     */
    constructor(id, contentId, episodeId, profileId, rating, comment)
    {
        this.id = id;
        this.contentId = contentId;
        this.episodeId = episodeId;
        this.profileId = profileId;
        this.rating = rating;
        this.comment = comment;
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Review) return rawObject;

        return new Review(
            rawObject.id,
            rawObject.contentId,
            rawObject.episodeId,
            rawObject.profileId,
            rawObject.rating,
            rawObject.comment
        );
    }
}

/**
 * Abstract Class acting as an interface for the Backend API.
 * One method per backend route, grouped by resource (User, Profile, Content, Episode,
 * Review, Admin). Defines the required contract for authentication, session management,
 * and data sync.
 *
 * All admin-only actions now live under /api/admin, consolidated by resource type
 * (users, content, reviews) rather than scattered across each resource's own base path.
 */
export class Interface_BackendAPI
{
    constructor()
    {
        // Prevent direct instantiation of the abstract class
        if (this.constructor === Interface_BackendAPI)
        {
            throw new Error("Cannot instantiate Abstract Class 'Interface_BackendAPI' directly.");
        }
    }

    // ==========================================
    //         User Routes (public/self)
    // ==========================================

    /**
     * Maps to POST /user/register with { email, phone, password, fullName, birthday }.
     * @param {string} email
     * @param {string} phone
     * @param {string} password
     * @param {string} fullName
     * @param {string} birthday
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async register(email, phone, password, fullName, birthday)
    {
        throw new Error("Method 'register()' must be implemented.");
    }

    /**
     * Maps to POST /user/login with { email_or_phone, password }.
     * @param {string} email_or_phone
     * @param {string} password
     * @returns {Promise<{success: boolean, token?: string, message?: string}>}
     */
    async login(email_or_phone, password)
    {
        throw new Error("Method 'login()' must be implemented.");
    }

    /**
     * Maps to POST /user/logout (Authorization: Bearer <sessionToken>). No body required.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async logout(sessionToken)
    {
        throw new Error("Method 'logout()' must be implemented.");
    }

    /**
     * Maps to GET /user/me (Authorization: Bearer <sessionToken>).
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, user?: UserInfo, message?: string}>}
     */
    async fetchActiveUserInfo(sessionToken)
    {
        throw new Error("Method 'fetchActiveUserInfo()' must be implemented.");
    }

    /**
     * Maps to PUT /user/me with the fields to change: { password?, email?, phone?, fullName?, birthday? }.
     * @param {string} sessionToken
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, user?: UserInfo}>}
     */
    async updateActiveUserInfo(sessionToken, changes)
    {
        throw new Error("Method 'updateActiveUserInfo()' must be implemented.");
    }

    // ==========================================
    //   Admin Routes - Users (/api/admin/users)
    // ==========================================

    /**
     * Maps to GET /admin/users with search/filter query params (admin only):
     * email_contains, phone_contains, fullname_contains, born_after, born_before,
     * joined_after, joined_before, limit, skip, sort, sortOrder.
     * NOTE: `sortOrder` only accepts "greater_to_smaller" (default) or "smaller_to_greater" -
     * any other value, including "asc"/"desc", returns an error. Same scheme applies to
     * getAllContentItems() and searchReviews() below.
     * @param {string} sessionToken
     * @param {Object} [queryParams={}]
     * @returns {Promise<{success: boolean, users?: Array<UserInfo>, message?: string}>}
     */
    async searchUsers(sessionToken, queryParams = {})
    {
        throw new Error("Method 'searchUsers()' must be implemented.");
    }

    /**
     * Maps to GET /admin/users/:user_id (admin only).
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, user?: UserInfo, message?: string}>}
     */
    async fetchUserById(sessionToken, userId)
    {
        throw new Error("Method 'fetchUserById()' must be implemented.");
    }

    /**
     * Maps to PUT /admin/users/:user_id (admin only), same body/behaviour as updateActiveUserInfo().
     * @param {string} sessionToken
     * @param {string} userId
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, user?: UserInfo}>}
     */
    async updateUserById(sessionToken, userId, changes)
    {
        throw new Error("Method 'updateUserById()' must be implemented.");
    }

    /**
     * Maps to DELETE /admin/users/:user_id (super admin only). Cascades to that user's
     * profiles and reviews (content average ratings are recalculated afterward).
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async deleteUser(sessionToken, userId)
    {
        throw new Error("Method 'deleteUser()' must be implemented.");
    }

    /**
     * Maps to PUT /admin/users/:user_id/permission (admin only) with BODY { permission_level }.
     * permission_level: 0 = USER, 1 = ADMIN, 2 = SUPER_ADMIN.
     * An admin cannot assign a level higher than their own, and cannot act on a user who is
     * already at or above their own level.
     * @param {string} sessionToken
     * @param {string} userId
     * @param {number} permissionLevel
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async setUserPermissionLevel(sessionToken, userId, permissionLevel)
    {
        throw new Error("Method 'setUserPermissionLevel()' must be implemented.");
    }

    /**
     * Maps to GET /admin/users/:user_id/tokens_count (admin only) - number of active
     * login tokens (sessions) a user currently has.
     * NOTE: on success this response has no `message` field, only `success` + `tokens_count`.
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, tokens_count?: number}>}
     */
    async getUserTokensCount(sessionToken, userId)
    {
        throw new Error("Method 'getUserTokensCount()' must be implemented.");
    }

    /**
     * Maps to GET /admin/profiles/:profileId/owner (admin only) - finds and returns the
     * user that owns a given profile. NOTE: this endpoint does not exist on the server yet;
     * see admin-find-user-by-profile.js for a controller implementation to integrate.
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, message?: string, user?: UserInfo}>}
     */
    async findUserByProfileId(sessionToken, profileId)
    {
        throw new Error("Method 'findUserByProfileId()' must be implemented.");
    }

    /**
     * Maps to POST /admin/users/:user_id/kick (admin only) - invalidates all of a user's
     * active tokens, forcing them to log in again everywhere. No body required.
     * NOTE: response is only { success }, no `message` field.
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean}>}
     */
    async kickUser(sessionToken, userId)
    {
        throw new Error("Method 'kickUser()' must be implemented.");
    }

    /**
     * Maps to POST /admin/users/:user_id/ban (admin only) with BODY { hours_to_ban }.
     * Bans the user for the given number of hours - does NOT kick their existing sessions
     * (call kickUser() separately if that's also needed).
     * NOTE: response is only { success }, no `message` field.
     * @param {string} sessionToken
     * @param {string} userId
     * @param {number} hoursToBan
     * @returns {Promise<{success: boolean}>}
     */
    async banUser(sessionToken, userId, hoursToBan)
    {
        throw new Error("Method 'banUser()' must be implemented.");
    }

    /**
     * Maps to GET /admin/users/:user_id/ban (admin only) - whether a user is currently banned.
     * NOTE: response is only { success, is_banned }, no `message` field.
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, is_banned?: boolean}>}
     */
    async isUserBanned(sessionToken, userId)
    {
        throw new Error("Method 'isUserBanned()' must be implemented.");
    }

    // ==========================================
    //              Profile Routes
    // ==========================================

    /**
     * Maps to POST /profile/ - creates a new default profile for the logged-in user.
     * No body required. Limited to 4 profiles per user - if the limit is reached, `success`
     * is false but `profiles` still returns the current (unchanged) profile list.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, message?: string, profiles?: Array<Profile>}>}
     */
    async createProfile(sessionToken)
    {
        throw new Error("Method 'createProfile()' must be implemented.");
    }

    /**
     * Maps to GET /profile/ - all profiles belonging to the logged-in user.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, profiles?: Array<Profile>, message?: string}>}
     */
    async fetchAllProfiles(sessionToken)
    {
        throw new Error("Method 'fetchAllProfiles()' must be implemented.");
    }

    /**
     * Maps to GET /profile/:profileId - lightweight summary of a single profile
     * ({ id, profileName, age, ImageName } only - no watch history / likes).
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, profile?: Profile, message?: string}>}
     */
    async fetchProfileById(sessionToken, profileId)
    {
        throw new Error("Method 'fetchProfileById()' must be implemented.");
    }

    /**
     * Maps to GET /profile/:profileId/details - full profile document, including
     * likedContentIds and lastWatched (see Profile.fromJSON for the exact shape).
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, profile?: Profile, message?: string}>}
     */
    async fetchProfileDetails(sessionToken, profileId)
    {
        throw new Error("Method 'fetchProfileDetails()' must be implemented.");
    }

    /**
     * Maps to PUT /profile/:profileId with { profileName?, age?, ImageName? }.
     * Returns the caller's FULL updated profile list, not just the one changed profile.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, profiles?: Array<Profile>}>}
     */
    async updateProfile(sessionToken, profileId, changes)
    {
        throw new Error("Method 'updateProfile()' must be implemented.");
    }

    /**
     * Maps to PUT /profile/ with { updates: [{ profileId, profileName?, age?, ImageName? }] }.
     * Bulk-updates multiple profiles belonging to the logged-in user in one call.
     * @param {string} sessionToken
     * @param {Array<{profileId: string, profileName?: string, age?: number, ImageName?: string}>} updates
     * @returns {Promise<{success: boolean, message?: string, profiles?: Array<Profile>}>}
     */
    async saveProfiles(sessionToken, updates)
    {
        throw new Error("Method 'saveProfiles()' must be implemented.");
    }

    /**
     * Maps to DELETE /profile/:profileId. A user's last remaining profile cannot be deleted -
     * the request fails and `profiles` still returns the current (unchanged) profile list.
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, message?: string, profiles?: Array<Profile>}>}
     */
    async deleteProfile(sessionToken, profileId)
    {
        throw new Error("Method 'deleteProfile()' must be implemented.");
    }

    /**
     * Maps to POST /profile/:profileId/likes/:contentId - toggles a like (add or remove).
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @returns {Promise<{success: boolean, message?: string, liked?: boolean, likedContentIds?: Array<string>}>}
     */
    async toggleContentLike(sessionToken, profileId, contentId)
    {
        throw new Error("Method 'toggleContentLike()' must be implemented.");
    }

    /**
     * Maps to POST /profile/:profileId/watch/:contentId - records that a profile just
     * watched a piece of content, no specific episode given. Resumes from the profile's
     * saved episode for that content if one exists, otherwise starts at season 1 episode 1.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode, lastWatched?: Array<{episode_id: string, content_id: string}>}>}
     */
    async recordWatch(sessionToken, profileId, contentId)
    {
        throw new Error("Method 'recordWatch()' must be implemented.");
    }

    /**
     * Maps to POST /profile/:profileId/watch/:contentId/:episodeId - same as recordWatch(),
     * but records this specific episode as watched instead of resuming/defaulting.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @param {string} episodeId
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode, lastWatched?: Array<{episode_id: string, content_id: string}>}>}
     */
    async recordWatchEpisode(sessionToken, profileId, contentId, episodeId)
    {
        throw new Error("Method 'recordWatchEpisode()' must be implemented.");
    }

    /**
     * Maps to GET /profile/:profileId/other_profiles_recommendations - content that the
     * user's OTHER profiles (same account) have watched or liked, excluding anything this
     * profile has already watched or liked itself.
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, message?: string, content?: Array<ContentItem>}>}
     */
    async getOtherProfilesRecommendations(sessionToken, profileId)
    {
        throw new Error("Method 'getOtherProfilesRecommendations()' must be implemented.");
    }

    /**
     * Maps to GET /profile/:profileId/top_picks - up to 3 top-rated content items based on
     * this profile's own taste (its top 3 most common categories among watched/liked content,
     * excluding anything already watched or liked). Returns an empty list (not an error) if
     * the profile has no watch/like history yet.
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, message?: string, content?: Array<ContentItem>}>}
     */
    async getTopPicks(sessionToken, profileId)
    {
        throw new Error("Method 'getTopPicks()' must be implemented.");
    }

    // ==========================================
    //         Content Routes (public)
    // ==========================================

    /**
     * Maps to GET /content/:contentId (public, no token required).
     * @param {string} contentId
     * @returns {Promise<{success: boolean, content?: ContentItem, message?: string}>}
     */
    async getContentByID(contentId)
    {
        throw new Error("Method 'getContentByID()' must be implemented.");
    }

    /**
     * Maps to GET /content/ (public). Supports optional search/filter query params:
     * title_contains, exact_category, contain_category, exclude_category, type,
     * released_after, released_before, min_age_limit, max_age_limit, min_likes,
     * min_average_rating, max_average_rating, min_review_count, max_review_count,
     * limit, skip, sort, sortOrder. Called with no arguments, returns all content.
     * @param {Object} [queryParams={}]
     * @returns {Promise<{success: boolean, content?: Array<ContentItem>, message?: string}>}
     */
    async getAllContentItems(queryParams = {})
    {
        throw new Error("Method 'getAllContentItems()' must be implemented.");
    }

    /**
     * Maps to GET /content/:contentId/episodes (public). Only works for type "series".
     * Returns episodes grouped by season - seasons[0] is season 1's episode list,
     * seasons[1] is season 2's, etc.
     * @param {string} contentId
     * @returns {Promise<{success: boolean, message?: string, seasons?: Array<Array<Episode>>}>}
     */
    async getContentEpisodes(contentId)
    {
        throw new Error("Method 'getContentEpisodes()' must be implemented.");
    }

    /**
     * Maps to GET /content/:contentId/episodes/:episodeId (public).
     * @param {string} contentId
     * @param {string} episodeId
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode}>}
     */
    async getEpisodeById(contentId, episodeId)
    {
        throw new Error("Method 'getEpisodeById()' must be implemented.");
    }

    /**
     * Maps to GET /content/:contentId/episodes/:episodeId/next (public). Crosses into the
     * next season if this was the last episode of its season. `episode` is absent if this
     * was the final episode of the whole series.
     * @param {string} contentId
     * @param {string} episodeId
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode}>}
     */
    async getNextEpisode(contentId, episodeId)
    {
        throw new Error("Method 'getNextEpisode()' must be implemented.");
    }

    /**
     * Maps to GET /content/:contentId/episodes/:episodeId/prev (public). Crosses back into
     * the previous season if this was the first episode of its season. `episode` is absent
     * if this was the very first episode of the series.
     * @param {string} contentId
     * @param {string} episodeId
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode}>}
     */
    async getPrevEpisode(contentId, episodeId)
    {
        throw new Error("Method 'getPrevEpisode()' must be implemented.");
    }

    // ==========================================
    //  Admin Routes - Content (/api/admin/content)
    // ==========================================

    /**
     * Maps to POST /admin/content (admin only).
     * Required: title, type ("movie"|"series"), release_date.
     * Optional: description, cover_image_name, categories, age_limit.
     * @param {string} sessionToken
     * @param {Object} contentData
     * @returns {Promise<{success: boolean, message?: string, content?: ContentItem}>}
     */
    async createContent(sessionToken, contentData)
    {
        throw new Error("Method 'createContent()' must be implemented.");
    }

    /**
     * Maps to PUT /admin/content/:contentId (admin only).
     * @param {string} sessionToken
     * @param {string} contentId
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, content?: ContentItem}>}
     */
    async updateContent(sessionToken, contentId, changes)
    {
        throw new Error("Method 'updateContent()' must be implemented.");
    }

    /**
     * Maps to DELETE /admin/content/:contentId (admin only).
     * @param {string} sessionToken
     * @param {string} contentId
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async deleteContent(sessionToken, contentId)
    {
        throw new Error("Method 'deleteContent()' must be implemented.");
    }

    /**
     * Maps to POST /admin/content/:contentId/episodes (admin only) - adds a new episode to
     * a series. Movies cannot have episodes added this way - use setMovieVideo() instead.
     * @param {string} sessionToken
     * @param {string} contentId
     * @param {{season_number: number, episode_number: number, title?: string, videoUrl?: string}} episodeData
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode}>}
     */
    async addEpisode(sessionToken, contentId, episodeData)
    {
        throw new Error("Method 'addEpisode()' must be implemented.");
    }

    /**
     * Maps to PUT /admin/content/:contentId/movie-video (admin only) with { videoUrl }.
     * Creates or updates the single video for a movie (movies only). Internally this is
     * still backed by a single Episode entry (season 1, episode 1), but the caller never
     * needs to know that.
     * @param {string} sessionToken
     * @param {string} contentId
     * @param {string} videoUrl
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode}>}
     */
    async setMovieVideo(sessionToken, contentId, videoUrl)
    {
        throw new Error("Method 'setMovieVideo()' must be implemented.");
    }

    /**
     * Maps to PUT /admin/content/:contentId/episodes/:episodeId (admin only). Not restricted
     * by content type - a movie's single episode can be edited too.
     * @param {string} sessionToken
     * @param {string} contentId
     * @param {string} episodeId
     * @param {{season_number?: number, episode_number?: number, title?: string, videoUrl?: string}} changes
     * @returns {Promise<{success: boolean, message?: string, episode?: Episode}>}
     */
    async updateEpisode(sessionToken, contentId, episodeId, changes)
    {
        throw new Error("Method 'updateEpisode()' must be implemented.");
    }

    /**
     * Maps to DELETE /admin/content/:contentId/episodes/:episodeId (admin only).
     * @param {string} sessionToken
     * @param {string} contentId
     * @param {string} episodeId
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async deleteEpisode(sessionToken, contentId, episodeId)
    {
        throw new Error("Method 'deleteEpisode()' must be implemented.");
    }

    // ==========================================
    //           Review Routes (/api/reviews)
    // ==========================================

    /**
     * Maps to POST /reviews/:profileId/:contentId/:episodeId with { rating, comment? }.
     * A profile can only review a given episode once - adding a second is rejected, not
     * merged or overwritten. rating must be a number between 1 and 10. comment has a 500
     * character limit. Adding a review automatically recalculates that content's
     * average_rating and review_count.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @param {string} episodeId
     * @param {number} rating
     * @param {string} [comment]
     * @returns {Promise<{success: boolean, message?: string, review?: Review}>}
     */
    async addReview(sessionToken, profileId, contentId, episodeId, rating, comment)
    {
        throw new Error("Method 'addReview()' must be implemented.");
    }

    /**
     * Maps to PUT /reviews/:profileId/:contentId/:episodeId with { rating?, comment? } -
     * edits this profile's own review for a specific episode. Editing the rating
     * automatically recalculates that content's average_rating.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @param {string} episodeId
     * @param {{rating?: number, comment?: string}} changes
     * @returns {Promise<{success: boolean, message?: string, review?: Review}>}
     */
    async updateReview(sessionToken, profileId, contentId, episodeId, changes)
    {
        throw new Error("Method 'updateReview()' must be implemented.");
    }

    /**
     * Maps to DELETE /reviews/:profileId/:contentId/:episodeId - removes this profile's own
     * review for a specific episode. Recalculates that content's average_rating and
     * review_count.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @param {string} episodeId
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async deleteReview(sessionToken, profileId, contentId, episodeId)
    {
        throw new Error("Method 'deleteReview()' must be implemented.");
    }

    /**
     * Maps to GET /reviews/ (public, no login needed) with search/filter query params:
     * content_id, episode_id, profile_id, user_id, rating, min_rating, max_rating,
     * comment_starts, comment_ends, comment_contains, limit, skip, sort, sortOrder.
     * Filter by episode_id to see all reviews of one episode, or by profile_id together
     * with episode_id to find one profile's review of one episode.
     * @param {Object} [queryParams={}]
     * @returns {Promise<{success: boolean, message?: string, reviews?: Array<Review>}>}
     */
    async searchReviews(queryParams = {})
    {
        throw new Error("Method 'searchReviews()' must be implemented.");
    }

    // ==========================================
    //  Admin Routes - Reviews (/api/admin/reviews)
    // ==========================================

    /**
     * Maps to PUT /admin/reviews/:reviewId (admin only) with { rating?, comment? } - edits
     * any review directly by its ID, regardless of who wrote it. Editing the rating
     * automatically recalculates that content's average_rating.
     * @param {string} sessionToken
     * @param {string} reviewId
     * @param {{rating?: number, comment?: string}} changes
     * @returns {Promise<{success: boolean, message?: string, review?: Review}>}
     */
    async adminUpdateReview(sessionToken, reviewId, changes)
    {
        throw new Error("Method 'adminUpdateReview()' must be implemented.");
    }

    /**
     * Maps to DELETE /admin/reviews/:reviewId (admin only) - deletes any review directly by
     * its ID, regardless of who wrote it. Recalculates that content's average_rating and
     * review_count.
     * @param {string} sessionToken
     * @param {string} reviewId
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async adminDeleteReview(sessionToken, reviewId)
    {
        throw new Error("Method 'adminDeleteReview()' must be implemented.");
    }

    // ==========================================
    //  Admin Routes - Statistics (/api/admin/*-statistics)
    // ==========================================

    /**
     * Maps to GET /admin/users-statistics (admin only) - aggregated statistics about all
     * users on the server. No query params - always computed over the entire user base.
     *
     * res.statistics shape:
     *   profileDistribution: Array<{ NumberOfProfiles: number, UsersCount: number }>
     *     - one entry per possible profile count, from 1 to MAX_PROFILES_LIMIT (currently 4);
     *       UsersCount is 0 if no user currently has that exact number of profiles.
     *   userGrowth: Array<{ Month: string, NewUsers: number }>
     *     - one entry per month ("YYYY-MM"), covering the last 6 months (including the
     *       current one); NewUsers is 0 for any month with no new registrations.
     *   ageDistribution: Array<{ AgeRange: string, UsersCount: number }>
     *     - one entry per bucket: "Under 18 / Invalid", "18-24", "25-34", "35-44", "45-59",
     *       "60-119", "120+"; UsersCount is 0 for any bucket with no matching users.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, message?: string, statistics?: Object}>}
     */
    async getUsersStatistics(sessionToken)
    {
        throw new Error("Method 'getUsersStatistics()' must be implemented.");
    }

    /**
     * Maps to GET /admin/content-statistics (admin only) - aggregated statistics about all
     * content on the server. No query params - always computed over all content.
     *
     * res.statistics shape:
     *   categoryDistribution: Array<{ Category: string, TitlesCount: number }>
     *     - one entry per category that actually exists on some content item, sorted from
     *       most titles to least (no fixed/known list of categories, so none are zero-filled).
     *   episodesPerSeriesStats:
     *     {
     *       averageEpisodesPerSeries: number,
     *       episodesDistribution: Array<{ EpisodesRange: string, SeriesCount: number }>
     *     }
     *     - episodesDistribution has one entry per bucket: "0", "1-4", "5-9", "10-19",
     *       "20-49", "50+"; SeriesCount is 0 for any bucket with no matching series.
     *       Series with 0 episodes count as 0 in both averageEpisodesPerSeries and the
     *       "0" bucket.
     *   ageDistribution: Array<{ AgeRange: string, TitlesCount: number }>
     *     - based on age_limit, one entry per bucket: "Invalid", "0-6", "7-12", "13-15",
     *       "16-17", "18+"; TitlesCount is 0 for any bucket with no matching content.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, message?: string, statistics?: Object}>}
     */
    async getContentStatistics(sessionToken)
    {
        throw new Error("Method 'getContentStatistics()' must be implemented.");
    }

    /**
     * Maps to GET /admin/reviews-statistics (admin only) - aggregated statistics about all
     * reviews on the server. No query params - always computed over all reviews.
     *
     * res.statistics shape:
     *   ratingDistribution: Array<{ Rating: number, ReviewsCount: number }>
     *     - one entry per rating value from 1 to 10; ReviewsCount is 0 for any rating with
     *       no matching reviews.
     *   categoryAverageRating: Array<{ Category: string, AverageRating: number, ReviewsCount: number }>
     *     - one entry per category that appears on some reviewed content, sorted from most
     *       reviewed to least (no fixed/known list of categories, so none are zero-filled).
     *   monthlyAverageRating: Array<{ Month: string, AverageRating: number, ReviewsCount: number }>
     *     - one entry per month ("YYYY-MM"), covering the last 6 months (including the
     *       current one); months with no reviews show AverageRating: 0 and ReviewsCount: 0.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, message?: string, statistics?: Object}>}
     */
    async getReviewsStatistics(sessionToken)
    {
        throw new Error("Method 'getReviewsStatistics()' must be implemented.");
    }
}