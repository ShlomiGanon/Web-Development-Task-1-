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
     * Accepts either Liked_Content_IDs (full profile) or likedContentIds (pressLike response).
     * @param {Object} rawObject
     * @returns {Profile|null}
     */
    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Profile) return rawObject;

        const likedIds = rawObject.Liked_Content_IDs ?? rawObject.likedContentIds ?? [];

        return new Profile(
            rawObject.id,
            rawObject.profileName,
            rawObject.age,
            rawObject.ImageName,
            rawObject.LastWatched_Content_IDs,
            likedIds
        );
    }

    /**
     * Converts back to the shape the backend expects on write (updateProfile body).
     */
    toJSON()
    {
        return {
            id: this.id,
            profileName: this.name,
            age: this.age,
            ImageName: this.imageName,
            LastWatched_Content_IDs: this.LastWatched_Content_IDs,
            Liked_Content_IDs: Array.from(this.wasLiked_Content_IDs)
        };
    }
}

// ==========================================
//                UserInfo
// ==========================================

export class UserInfo
{
    /**
     * @param {string} email
     * @param {string} phone
     * @param {string} fullName
     * @param {Array<Profile|Object>} [rawProfiles=[]]
     */
    constructor(email, phone, fullName, rawProfiles = [])
    {
        this.email = email;
        this.phone = phone;
        this.fullName = fullName;
        this.profiles = rawProfiles.map(p => p instanceof Profile ? p : Profile.fromJSON(p));
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof UserInfo) return rawObject;
        return new UserInfo(rawObject.email, rawObject.phone, rawObject.fullName, rawObject.profiles);
    }

    toJSON()
    {
        return {
            email: this.email,
            phone: this.phone,
            fullName: this.fullName,
            profiles: this.profiles.map(p => p.toJSON())
        };
    }
}

// ==========================================
//               ContentItem
// ==========================================

export class ContentItem
{
    /**
     * @param {string} id - Unique identifier as returned by the backend (opaque, do not assume a numeric format).
     * @param {string} name - Content title.
     * @param {string} [cover_imageName] - Cover image filename.
     * @param {number} [likes=0]
     * @param {string} [type] - "movie" | "series".
     * @param {Array<string>} [categories=[]]
     * @param {string} [description]
     * @param {number} [age_limit=0]
     * @param {string} [videoUrl]
     */
    constructor(id, name, cover_imageName, likes = 0, type, categories = [], description, age_limit = 0, videoUrl)
    {
        this.id = id;
        this.name = name;
        this.cover_imageName = cover_imageName;
        this.likes = likes;
        this.type = type;
        this.categories = Array.isArray(categories) ? categories : [];
        this.description = description;
        this.age_limit = age_limit;
        this.videoUrl = videoUrl;
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
            rawObject.videoUrl
        );
    }
}

/**
 * Abstract Class acting as an interface for the Backend API.
 * One method per backend route, grouped by resource (User, Admin, Profile, Content).
 * Defines the required contract for authentication, session management, and data sync.
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
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{success: boolean, sessionToken?: string, message?: string}>}
     */
    async attemptLoginByEmail(email, password)
    {
        throw new Error("Method 'attemptLoginByEmail()' must be implemented.");
    }

    /**
     * Maps to POST /user/login with { email_or_phone, password }.
     * @param {string} phone
     * @param {string} password
     * @returns {Promise<{success: boolean, sessionToken?: string, message?: string}>}
     */
    async attemptLoginByPhone(phone, password)
    {
        throw new Error("Method 'attemptLoginByPhone()' must be implemented.");
    }

    /**
     * Maps to POST /user/logout (Authorization: Bearer <sessionToken>).
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
     * @returns {Promise<{success: boolean, data?: UserInfo, message?: string}>}
     */
    async fetchActiveUserInfo(sessionToken)
    {
        throw new Error("Method 'fetchActiveUserInfo()' must be implemented.");
    }

    /**
     * Maps to PUT /user/me with the fields to change (e.g. { email, phone }).
     * @param {string} sessionToken
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, data?: UserInfo}>}
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
     * (e.g. email_contains, fullname_starts, joined_after, limit, skip, sort, sortOrder).
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
     * @param {string} sessionToken
     * @param {string} userId
     * @returns {Promise<{success: boolean, data?: UserInfo, message?: string}>}
     */
    async fetchUserById(sessionToken, userId)
    {
        throw new Error("Method 'fetchUserById()' must be implemented.");
    }

    /**
     * Maps to PUT /user/:user_id (admin only).
     * @param {string} sessionToken
     * @param {string} userId
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, data?: UserInfo}>}
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
     * Maps to PUT /user/:user_id/permission?permission_level=<level> (admin only).
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
     * Maps to GET /profile/:profileId - lightweight summary of a single profile.
     * @param {string} sessionToken
     * @param {string} profileId
     * @returns {Promise<{success: boolean, profile?: Profile, message?: string}>}
     */
    async fetchProfileById(sessionToken, profileId)
    {
        throw new Error("Method 'fetchProfileById()' must be implemented.");
    }

    /**
     * Maps to GET /profile/:profileId/details - full profile document.
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
     * Maps to PUT /profile with { updates: [{ profileId, profileName, age, ImageName }] }.
     * Bulk-updates multiple profiles belonging to the logged-in user in one call.
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
     * @param {string} profileID
     * @param {string} contentID
     * @returns {Promise<{success: boolean, message?: string, liked?: boolean, likedContentIds?: Array<string>}>}
     */
    async toggleContentLike(sessionToken, profileID, contentID)
    {
        throw new Error("Method 'toggleContentLike()' must be implemented.");
    }

    /**
     * Maps to POST /profile/:profileId/watch/:contentId - records a watch, moves it to the front of history.
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
     * @param {string} contentID
     * @returns {Promise<{success: boolean, data?: ContentItem, message?: string}>}
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
     * @param {Object} [queryParams={}]
     * @returns {Promise<{success: boolean, data?: Array<ContentItem>, message?: string}>}
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
     * @param {string} sessionToken
     * @param {Object} contentData
     * @returns {Promise<{success: boolean, message?: string, data?: ContentItem}>}
     */
    async createContent(sessionToken, contentData)
    {
        throw new Error("Method 'createContent()' must be implemented.");
    }

    /**
     * Maps to PUT /content/:contentId (admin only).
     * @param {string} sessionToken
     * @param {string} contentID
     * @param {Object} changes
     * @returns {Promise<{success: boolean, message?: string, data?: ContentItem}>}
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