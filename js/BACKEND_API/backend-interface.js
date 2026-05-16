export class Profile 
{
    constructor(id, name, imageName = "undefined") 
    {
        this.id = id;
        this.name = name;
        this.imageName = imageName;
        if (imageName === "undefined")
        {
            this.imageName = "profile1.png";//on the future we will generate a random image name
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
        if("imageName" in rawObject && rawObject.imageName)
        {
            return new Profile(rawObject.id, rawObject.name, rawObject.imageName);
        }
        else
        {
            return new Profile(rawObject.id, rawObject.name);
        }
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
    * @param {string} full_name - The user's full name.
    * @param {Array<Profile|Object>} rawProfiles - Collection of profiles, as Profile instances or raw JSON objects.
    */
    constructor(email, phone, full_name, rawProfiles = []) 
    {
        this.email = email;
        this.phone = phone;
        this.full_name = full_name;
        this.profiles = rawProfiles.map
        (
            p => 
            p instanceof Profile ? p : Profile.fromJSON(p)
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
        return new UserInfo(rawObject.email, rawObject.phone, rawObject.full_name, rawObject.profiles);
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
     * @returns {Promise<{success: boolean, message?: string}>} Token generation status without user data.
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
     * @returns {Promise<{success: boolean, message?: string}>} Token generation status without user data.
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
     * @returns {Promise<{success: boolean, message?: string}>} Registration success or failure status.
     */
    async register(email, phone, password) 
    {
        throw new Error("Method 'register()' must be implemented.");
    }

    /**
     * Step 2: Secured User Info Fetching
     * Identifies the specific client via their active session token, retrieves their 
     * authorized user from the server registry, and populates a dedicated UserInfo instance.
     * 
     * @returns {Promise<{success: boolean, data?: UserInfo, message?: string}>} Success status with a UserInfo instance payload.
     */
    async fetchUserInfo() 
    {
        throw new Error("Method 'fetchUserInfo()' must be implemented.");
    }

    /**
     * Synchronizes and updates the active user's profiles array on the server.
     * 
     * @param {Array} profiles - The complete updated profiles array from the UI.
     * @returns {Promise<{success: boolean, message?: string}>} Operation acknowledgment status.
     */
    async updateProfiles(profiles) 
    {
        throw new Error("Method 'updateProfiles()' must be implemented.");
    }

    /**
     * Inspects the local client environment (e.g., cookies) for an active, valid session state
     * and maps it back into a UserInfo instance to persist state across page reloads.
     * 
     * @returns {UserInfo|null} The current active UserInfo data model, or null if unauthenticated.
     */
    async getCurrentSession()
    {
        throw new Error("Method 'getCurrentSession()' must be implemented.");
    }

    /**
     * Terminates the active session, revokes the server-side connection token, 
     * and purges all client-side session data and cookies.
     * 
     * @returns {void}
     */
    logout() 
    {
        throw new Error("Method 'logout()' must be implemented.");
    }
}