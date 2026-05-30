import * as Constants from '../constances.js';

export class Profile 
{
    /**
     * Initializes a Profile instance with the given parameters.
     * 
     * @param {number} id - The unique identifier of the profile.
     * @param {string} name - The name of the profile.
     * @param {string} [imageName="profile1.png"] - The name of the image file for the profile.
     * @param {Array<number>} [LastWatched_Media_IDs=[]] - The array of media item IDs last watched by the profile.
     * @param {Set<number>|Array<number>} [wasLiked_Media_IDs=[]] - The collection of media item IDs liked by the profile. Will be stored internally as a Set.
     */
    constructor(id, name, imageName = "UNDEFINED_PROFILE.png", LastWatched_Media_IDs = [], wasLiked_Media_IDs = []) 
    {
        this.id = id;
        this.name = name;
        if (!imageName)imageName = "UNDEFINED_PROFILE.png";
        this.imageName = imageName;
        
        const rawWatchIDs = Array.isArray(LastWatched_Media_IDs) ? LastWatched_Media_IDs : [];
        this.LastWatched_Media_IDs = rawWatchIDs.slice(0, Constants.MAX_LAST_WATCHED_MEDIA_LIMIT);
        
        if (wasLiked_Media_IDs instanceof Set) 
        {
            this.wasLiked_Media_IDs = wasLiked_Media_IDs;
        } 
        else
        {
            const rawLikeIDs = Array.isArray(wasLiked_Media_IDs) ? wasLiked_Media_IDs : [];
            this.wasLiked_Media_IDs = new Set(rawLikeIDs);
        }
    }

    /**
     * Static method to create a Profile instance from a raw JSON object.
     * @param {Object} rawObject - The raw JSON object to create a Profile instance from.
     * @returns {Profile} The Profile instance created from the raw JSON object.
     */
    static fromJSON(rawObject) 
    {
        if (!rawObject) return null;
        if (rawObject instanceof Profile) return rawObject;
        return new Profile(
            rawObject.id,
            rawObject.name,
            rawObject.imageName,
            rawObject.LastWatched_Media_IDs,
            rawObject.wasLiked_Media_IDs
        );
    }

    toJSON() 
    {
        return {
            id: this.id,
            name: this.name,
            imageName: this.imageName,
            LastWatched_Media_IDs: this.LastWatched_Media_IDs,
            wasLiked_Media_IDs: Array.from(this.wasLiked_Media_IDs)
        };
    }
}

//a class to store the user information
export class UserInfo 
{
    /**
    * Initializes a structured container for authenticated user data and their profiles.
    * 
    * @param {string} email - The user's unique email address.
    * @param {string} phone - The user's unique phone number.
    * @param {string} fullName - The user's full name.
    * @param {Array<Profile|Object>} rawProfiles - Collection of profiles, as Profile instances or raw JSON objects.
    */
    constructor(email, phone, fullName, rawProfiles = []) 
    {
        this.email = email;
        this.phone = phone;
        this.fullName = fullName;
        this.profiles = rawProfiles.map
        (
            p => p instanceof Profile ? p : Profile.fromJSON(p)
        );
    }

    /**
     * Static method to create a UserInfo instance from a raw JSON object.
     * @param {Object} rawObject - The raw JSON object to create a UserInfo instance from.
     * @returns {UserInfo} The UserInfo instance created from the raw JSON object.
     */
    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof UserInfo) return rawObject;
        return new UserInfo(rawObject.email, rawObject.phone, rawObject.fullName, rawObject.profiles);
    }

    /**
     * Converts the UserInfo instance to a JSON object.
     * @returns {Object} The JSON object representing the UserInfo instance.
     */
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

export class MediaItem
{
    constructor(id, name, coverImageName = null, likes = 0) 
    {
        this.id = Number(id);
        this.name = name;
        this.coverImageName = coverImageName ? coverImageName : "media1.png";
        this.likes = likes;
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;

        return new MediaItem(rawObject.id, rawObject.name, rawObject.coverImageName, rawObject.likes);
    }
}

/**
 * Abstract Class acting as an interface for the Backend API.
 * Defines the required contract for authentication, session management, and profile synchronization.
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

    /**
     * Step 1A: Email Authentication Attempt
     * Validates credentials via email and, upon success, establishes an isolated, 
     * one-to-one session linkage in the server registry for this specific client.
     * 
     * @param {string} email - The user's registered email address.
     * @param {string} password - The plain-text password provided by the user.
     * @returns {Promise<{success: boolean, sessionToken?: string, message?: string}>} Token generation status without user data.
     */
    async attemptLoginByEmail(email, password) 
    {
        throw new Error("Method 'attemptLoginByEmail()' must be implemented.");
    }

    /**
     * Step 1B: Phone Authentication Attempt
     * Validates credentials via phone number and, upon success, establishes an isolated, 
     * one-to-one session linkage in the server registry for this specific client.
     * 
     * @param {string} phone - The user's registered phone number.
     * @param {string} password - The plain-text password provided by the user.
     * @returns {Promise<{success: boolean, sessionToken?: string, message?: string}>} Token generation status without user data.
     */
    async attemptLoginByPhone(phone, password) 
    {
        throw new Error("Method 'attemptLoginByPhone()' must be implemented.");
    }

    /**
     * User Registration
     * Creates a new user record in the server storage system with the provided credentials.
     * 
     * @param {string} email - The user's unique email address.
     * @param {string} phone - The user's unique phone number.
     * @param {string} password - The chosen password.
     * @param {string} full_name - The user's full name.
     * @returns {Promise<{success: boolean, message?: string}>} Registration success or failure status.
     */
    async register(email, phone, password, full_name) 
    {
        throw new Error("Method 'register()' must be implemented.");
    }

    /**
     * Step 2: Secured User Info Fetching
     * Identifies the specific client via their active session token, retrieves their 
     * authorized user from the server registry, and populates a dedicated UserInfo instance.
     * 
     * @param {string} sessionToken - Token identifying the authenticated client session.
     * @returns {Promise<{success: boolean, data?: UserInfo, message?: string}>} Success status with a UserInfo instance payload.
     */
    async fetchActiveUserInfo(sessionToken) 
    {
        throw new Error("Method 'fetchActiveUserInfo()' must be implemented.");
    }

    /**
     * Synchronizes and updates the active user's profiles array on the server.
     * 
     * @param {string} sessionToken - Token identifying the authenticated client session.
     * @param {Array} profiles - The complete updated profiles array from the UI.
     * @returns {Promise<{success: boolean, message?: string}>} Operation acknowledgment status.
     */
    async saveProfiles(sessionToken, profiles) 
    {
        throw new Error("Method 'saveProfiles()' must be implemented.");
    }

    /**
     * Terminates the active session, revokes the server-side connection token, 
     * and purges all client-side session data and cookies.
     * 
     * @param {string} sessionToken - Token identifying the authenticated client session to terminate.
     * @returns {Promise<{success: boolean, message?: string}>} Server acknowledgment status of the logout.
     */
    async logout(sessionToken) 
    {
        throw new Error("Method 'logout()' must be implemented.");
    }

    /**
     * Retrieves a media item by its unique identifier.
     * 
     * @param {string} mediaID - The unique identifier of the media item.
     * @returns {Promise<{success: boolean, data?: MediaItem, message?: string}>} Success status with a MediaItem instance payload.
     */
    async getMediaByID(mediaID)
    {
        throw new Error("Method 'getMediaByID()' must be implemented.");
    }

    /**
     * Toggles a like to a media item. (remove or add a like)
     * 
     * @param {string} sessionToken - Token identifying the authenticated client session.
     * @param {string} profileID - The unique identifier of the profile.
     * @param {string} mediaID - The unique identifier of the media item.
     * @returns {Promise<{success: boolean, message?: string}>} Operation acknowledgment status.
     */
    async toggleMediaLike(sessionToken, profileID, mediaID)
    {
        throw new Error("Method 'toggleMediaLike()' must be implemented.");
    }

    /**
     * Retrieves all media items.
     * 
     * @returns {Promise<{success: boolean, data?: Array<MediaItem>, message?: string}>} Success status with an array of MediaItem instances.
     */
    async getAllMediaItems()
    {
        throw new Error("Method 'getAllMediaItems()' must be implemented.");
    }

    /**
     * Selects a media item and adds it to the user's LastWatched list.
     * 
     * @param {string} sessionToken - Token identifying the authenticated client session.
     * @param {string} profileID - The unique identifier of the profile.
     * @param {string} mediaID - The unique identifier of the media item.
     * @returns {Promise<{success: boolean, message?: string}>} Success status.
     */
    async selectMediaItem(sessionToken, profileID, mediaID)
    {
        throw new Error("Method 'selectMediaItem()' must be implemented.");
    }
}