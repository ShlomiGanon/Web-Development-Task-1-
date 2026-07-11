import * as Constants from '../constances.js';

// ==========================================
//                 Profile
// ==========================================

export class Profile
{
    /**
     * @param {string} id - Unique identifier as returned by the backend (opaque, do not assume a numeric format).
     * @param {string} name - Profile display name.
     * @param {number} [age=0] - Used for content age-gating.
     * @param {string} [imageName] - Profile image filename.
     * @param {Array<string>} [LastWatched_Content_IDs=[]]
     * @param {Set<string>|Array<string>} [wasLiked_Content_IDs=[]]
     */
    constructor(id, name, age = 0, imageName, LastWatched_Content_IDs = [], wasLiked_Content_IDs = [])
    {
        this.id = id;
        this.name = name;
        this.age = age;
        this.imageName = imageName;
        this.LastWatched_Content_IDs = Array.isArray(LastWatched_Content_IDs) ? LastWatched_Content_IDs : [];

        if (wasLiked_Content_IDs instanceof Set)
        {
            this.wasLiked_Content_IDs = wasLiked_Content_IDs;
        }
        else
        {
            const rawLikeIDs = Array.isArray(wasLiked_Content_IDs) ? wasLiked_Content_IDs : [];
            this.wasLiked_Content_IDs = new Set(rawLikeIDs);
        }
    }

    /**
     * Builds a Profile from a raw backend response object.
     *
     * FIXED (verified against the real Profile mongoose schema and profileController.js -
     * the previous version of this method assumed field names that don't actually exist
     * on the backend):
     * - The lightweight profile summary (createProfile / deleteProfile / updateProfile /
     *   getProfile / updateAllProfiles) is built via toProfileSummary() and returns
     *   { id, profileName, age, ImageName } only - no watch history / likes fields at all.
     * - The full profile document (GET /profile/:profileId/details, getProfileDetails)
     *   returns the raw Mongoose document AS-IS, with NO field renaming - so it has
     *   `_id` (not `id`), `LastWatched_Content_IDs`, and `Liked_Content_IDs`, matching the
     *   schema exactly. There is no "..._Media_IDs" naming anywhere on the backend.
     * @param {Object} rawObject
     * @returns {Profile|null}
     */
    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Profile) return rawObject;

        // id: lightweight summaries already expose `id`; the full profile document
        // (getProfileDetails) is a raw Mongoose doc and only has `_id`.
        const id = rawObject.id ?? rawObject._id;
        const lastWatchedIds = rawObject.LastWatched_Content_IDs ?? [];
        const likedIds = rawObject.Liked_Content_IDs ?? [];

        return new Profile(
            id,
            rawObject.profileName,
            rawObject.age,
            rawObject.ImageName,
            lastWatchedIds,
            likedIds
        );
    }

    /**
     * Converts back to the shape the backend expects on write (PUT /profile/:profileId body).
     *
     * FIXED: the backend's updateProfile controller only reads profileName / age / ImageName
     * from req.body - everything else (id, watch history, likes) is ignored if sent, since:
     *   - the profile id belongs in the URL path (:profileId), not the body.
     *   - watch history is only ever changed via POST /profile/:profileId/watch/:contentId.
     *   - likes are only ever changed via POST /profile/:profileId/likes/:contentId.
     * Sending the extra fields used to be harmless (silently ignored) but is misleading and
     * has been removed so this payload is an exact match for what the endpoint accepts.
     */
    toJSON()
    {
        return {
            id: this.id,
            profileName: this.name,
            age: this.age,
            ImageName: this.imageName
        };
    }

    update_LastWatched_Content_IDs(New_LastWatched_Content_IDs)
    {
        const New_Array = Array.isArray(New_LastWatched_Content_IDs) ? New_LastWatched_Content_IDs : [];
        this.LastWatched_Content_IDs = New_Array;
    }

    update_wasLiked_Content_IDs(New_wasLiked_Content_IDs)
    {
        if (New_wasLiked_Content_IDs instanceof Set)
        {
            this.wasLiked_Content_IDs = New_wasLiked_Content_IDs;
        }
        else
        {
            const rawLikeIDs = Array.isArray(New_wasLiked_Content_IDs) ? New_wasLiked_Content_IDs : [];
            this.wasLiked_Content_IDs = new Set(rawLikeIDs);
        }
    }
}

// ==========================================
//                UserInfo
// ==========================================

export class UserInfo
{
    /**
     * FIXED: added `id`, `birthday`, and `createdAt` - every user endpoint on the backend
     * (register aside) returns a "safe_user" object shaped exactly as
     * { id, email, phone, fullName, birthday, createdAt }. The previous version of this class
     * silently dropped id/birthday/createdAt, which are needed for things like sending admin
     * requests (needs id) or displaying the birthday/join-date in a UI.
     *
     * NOTE: no backend endpoint returns a user bundled together with their profiles in one
     * response. GET /user/me and friends return ONLY the fields above - profiles must be
     * fetched separately via the Profile routes (fetchAllProfiles) and merged on the client
     * if you want a combined view. `rawProfiles` will simply stay empty unless you pass them
     * in yourself after a separate call.
     * @param {string} id
     * @param {string} email
     * @param {string} phone
     * @param {string} fullName
     * @param {Date} [birthday]
     * @param {Date} [createdAt]
     * @param {Array<Profile|Object>} [rawProfiles=[]]
     * @param {number} [permission_level]
     */
    constructor(id, email, phone, fullName, birthday, createdAt, rawProfiles = [] , permission_level = undefined)
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
     * FIXED: added `release_date` and `createdAt` - both are returned by every content
     * endpoint on the backend and were previously dropped entirely (release_date is also
     * what /content search results are sorted by, by default).
     *  
        id: content._id.toString(),
        title: content.title,
        description: content.description,
        cover_image_name: content.cover_image_name,
        type: content.type,
        categories: content.categories,
        release_date: content.release_date,
        age_limit: content.age_limit,
        likes: content.likes,
        videoUrl: content.videoUrl,
        createdAt: content.createdAt
     */
    constructor(id, title, cover_image_name, likes = 0, type, categories = [], description, age_limit = 0, videoUrl, release_date, createdAt)
    {
        this.id = id;
        this.title = title;
        this.cover_image_name = cover_image_name;
        this.likes = likes;
        this.type = type;
        this.categories = Array.isArray(categories) ? categories : [];
        this.description = description;
        this.age_limit = age_limit;
        this.videoUrl = videoUrl;
        this.release_date = release_date;
        this.createdAt = createdAt;
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;

        return new ContentItem(
            rawObject.id,
            rawObject.title,
            rawObject.cover_image_name,
            rawObject.likes,
            rawObject.type,
            rawObject.categories,
            rawObject.description,
            rawObject.age_limit,
            rawObject.videoUrl,
            rawObject.release_date,
            rawObject.createdAt
        );
    }
}

/**
 * Abstract Class acting as an interface for the Backend API.
 * One method per backend route, grouped by resource (User, Admin, Profile, Content).
 * Defines the required contract for authentication, session management, and data sync.
 *
 * All "Maps to ..." notes below describe the CURRENT, VERIFIED behaviour of the backend
 * (confirmed directly against the route/controller/middleware/model source files).
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
     * NOTE: fullName is split on the first space only - firstName = word 1, lastName = word 2,
     * any extra words are silently ignored, and both must be letters-only (a-zA-Z).
     * NOTE: phone must match the Israeli format ^05[0-9]{8}$.
     * NOTE: password must be 4-16 characters.
     * NOTE: the 18+ age check on `birthday` is currently ENABLED on the backend
     * (ENABLE_18_AGE_LIMIT = true in scripts/constants.js).
     * NOTE: on success, the backend does NOT return a token or user object - call login()
     * separately right after a successful register().
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
     * Maps to POST /user/logout (Authorization: Bearer <sessionToken>).
     * No body required.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async logout(sessionToken)
    {
        throw new Error("Method 'logout()' must be implemented.");
    }

    /**
     * Maps to GET /user/me (Authorization: Bearer <sessionToken>).
     * FIXED: the backend's response field is `user`, not `data`.
     * @param {string} sessionToken
     * @returns {Promise<{success: boolean, user?: UserInfo, message?: string}>}
     */
    async fetchActiveUserInfo(sessionToken)
    {
        throw new Error("Method 'fetchActiveUserInfo()' must be implemented.");
    }

    /**
     * Maps to PUT /user/me with the fields to change: { password?, email?, phone?, fullName?, birthday? }.
     * FIXED: the backend now supports all five fields (previously only email/phone worked).
     * NOTE: birthday updates are also subject to the 18+ check (see register() above) and
     * must not be a future date.
     * FIXED: the backend's response field is `user`, not `data` - and it is populated even on
     * most failure responses (with the pre-change user data), not just on success.
     * @param {string} sessionToken
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, user?: UserInfo}>}
     */
    async updateActiveUserInfo(sessionToken, changes)
    {
        throw new Error("Method 'updateActiveUserInfo()' must be implemented.");
    }

    // ==========================================
    //         User Routes (admin only)
    // ==========================================

    /**
     * Maps to GET /user with search/filter query params (admin only).
     * See User.searchFilterMap on the backend for supported keys
     * (e.g. email_contains, phone_contains, fullname_contains, born_after, born_before,
     * joined_after, joined_before, limit, skip, sort, sortOrder).
     * NOTE: `sortOrder` only accepts the exact strings "greater_to_smaller" (descending,
     * the default) or "smaller_to_greater" (ascending) - any other value, including "asc"/"desc",
     * returns an error. getAllContentItems() below uses this same scheme.
     * @param {string} sessionToken
     * @param {Object} [queryParams={}]
     * @returns {Promise<{success: boolean, users?: Array<UserInfo>, message?: string}>}
     */
    async searchUsers(sessionToken, queryParams = {})
    {
        throw new Error("Method 'searchUsers()' must be implemented.");
    }

    /**
     * Maps to GET /user/:user_id (admin only).
     * FIXED: the backend's response field is `user`, not `data`.
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, user?: UserInfo, message?: string}>}
     */
    async fetchUserById(sessionToken, userId)
    {
        throw new Error("Method 'fetchUserById()' must be implemented.");
    }

    /**
     * Maps to PUT /user/:user_id (admin only), same body/behaviour as updateActiveUserInfo().
     * FIXED: the backend's response field is `user`, not `data`.
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
     * Maps to DELETE /user/:user_id (super admin only).
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async deleteUser(sessionToken, userId)
    {
        throw new Error("Method 'deleteUser()' must be implemented.");
    }

    /**
     * Maps to PUT /user/:user_id/permission (admin only) with BODY { permission_level }.
     * FIXED: permission_level is sent in the request BODY, not as a query string parameter.
     * permission_level: 0 = USER, 1 = ADMIN, 2 = SUPER_ADMIN.
     * @param {string} sessionToken
     * @param {string} userId
     * @param {number} permissionLevel
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async setUserPermissionLevel(sessionToken, userId, permissionLevel)
    {
        throw new Error("Method 'setUserPermissionLevel()' must be implemented.");
    }

    // ==========================================
    //              Profile Routes
    // ==========================================

    /**
     * Maps to POST /profile - creates a new default profile for the logged-in user.
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
     * Maps to GET /profile - all profiles belonging to the logged-in user.
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
     * LastWatched_Content_IDs and Liked_Content_IDs.
     * NOTE: on success the backend response has no `message` field, only `success` + `profile`.
     * NOTE: this returns the raw Mongoose document (via getProfileDetails), so unlike every
     * other profile endpoint it is NOT passed through toProfileSummary - the raw object has
     * `_id` rather than `id`. Profile.fromJSON() already accounts for this.
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
     * Maps to PUT /profile with { updates: [{ profileId, profileName?, age?, ImageName? }] }.
     * Bulk-updates multiple profiles belonging to the logged-in user in one call.
     * NOTE: a profileId in the array that does not belong to the logged-in user is silently
     * skipped (not an error) - check the returned `profiles` list to confirm what changed.
     * @param {string} sessionToken
     * @param {Array} profiles
     * @returns {Promise<{success: boolean, message?: string, profiles?: Array<Profile>}>}
     */
    async saveProfiles(sessionToken, profiles)
    {
        throw new Error("Method 'saveProfiles()' must be implemented.");
    }

    /**
     * Maps to DELETE /profile/:profileId.
     * NOTE: a user's last remaining profile cannot be deleted - the request fails and
     * `profiles` still returns the current (unchanged) profile list.
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
     * FIXED (verified against pressLike() in profileController.js): the backend's response
     * field on success is `likedContentIds`, not `likedMediaIds`. (Note: the backend's own
     * catch/error branch inconsistently uses `likedMediaIds: []` instead - harmless for us
     * since we bail out on `!success` before reading this field either way.)
     * NOTE: fails with an age-restriction error if the profile's age is below the content's
     * age_limit.
     * @param {string} sessionToken
     * @param {string} profileID
     * @param {string} contentID
     * @returns {Promise<{success: boolean, message?: string, liked?: boolean, likedContentIds?: Array<string>}>}
     */
    async toggleContentLike(sessionToken, profileID, contentID)
    {
        throw new Error("Method 'toggleContentLike()' must be implemented.");
    }

    /**
     * Maps to POST /profile/:profileId/watch/:contentId - records a watch, moves it to the
     * front of history, and trims history to the 5 most recent items.
     * NOTE: same age-restriction check as toggleContentLike().
     * @param {string} sessionToken
     * @param {string} profileID
     * @param {string} contentID
     * @returns {Promise<{success: boolean, message?: string, watchHistory?: Array<string>}>}
     */
    async selectContentItem(sessionToken, profileID, contentID)
    {
        throw new Error("Method 'selectContentItem()' must be implemented.");
    }

    // ==========================================
    //         Content Routes (public)
    // ==========================================

    /**
     * Maps to GET /content/:contentId (public, no token required).
     * FIXED: the backend's response field is `content`, not `data`.
     * @param {string} contentID
     * @returns {Promise<{success: boolean, content?: ContentItem, message?: string}>}
     */
    async getContentByID(contentID)
    {
        throw new Error("Method 'getContentByID()' must be implemented.");
    }

    /**
     * Maps to GET /content (public). Supports optional search/filter query params -
     * see Content.searchFilterMap on the backend (e.g. title_contains, exact_category,
     * contain_category, exclude_category, type, released_after/before, min/max_age_limit,
     * min_likes, limit, skip, sort, sortOrder). Called with no arguments, returns all content.
     * FIXED: the backend's response field is `content`, not `data`.
     * NOTE: `sortOrder` uses the same scheme as searchUsers() above: "greater_to_smaller" /
     * "smaller_to_greater" only (any other value, including "asc"/"desc", is rejected).
     * @param {Object} [queryParams={}]
     * @returns {Promise<{success: boolean, content?: Array<ContentItem>, message?: string}>}
     */
    async getAllContentItems(queryParams = {})
    {
        throw new Error("Method 'getAllContentItems()' must be implemented.");
    }

    // ==========================================
    //         Content Routes (admin only)
    // ==========================================

    /**
     * Maps to POST /content (admin only).
     * Required fields: title, type ("movie"|"series"), release_date.
     * Optional: description, cover_image_name, categories, age_limit, videoUrl.
     * FIXED: the backend's response field is `content`, not `data`.
     * @param {string} sessionToken
     * @param {Object} contentData
     * @returns {Promise<{success: boolean, message?: string, content?: ContentItem}>}
     */
    async createContent(sessionToken, contentData)
    {
        throw new Error("Method 'createContent()' must be implemented.");
    }

    /**
     * Maps to PUT /content/:contentId (admin only).
     * FIXED: the backend's response field is `content`, not `data`.
     * @param {string} sessionToken
     * @param {string} contentID
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, content?: ContentItem}>}
     */
    async updateContent(sessionToken, contentID, changes)
    {
        throw new Error("Method 'updateContent()' must be implemented.");
    }

    /**
     * Maps to DELETE /content/:contentId (admin only).
     * @param {string} sessionToken
     * @param {string} contentID
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async deleteContent(sessionToken, contentID)
    {
        throw new Error("Method 'deleteContent()' must be implemented.");
    }
}