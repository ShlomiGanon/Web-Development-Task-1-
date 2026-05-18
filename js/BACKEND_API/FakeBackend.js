import { Interface_BackendAPI, UserInfo, Profile, MediaItem } from './backend-interface.js';


class BackendUser extends UserInfo 
{
    constructor(email, phone, full_name, rawProfiles , password) 
    {
        super(email, phone, full_name, rawProfiles);
        this.password = password;
    }
    
    /**
     * Converts the BackendUser instance to a UserInfo instance.
     * @returns {UserInfo} The UserInfo instance created from the BackendUser instance.
     */
    toUserInfo()
    {
        return new UserInfo(this.email, this.phone, this.full_name, this.profiles);
    }

    /**
     * Static method to create a BackendUser instance from a raw JSON object.
     * @param {Object} rawObject - The raw JSON object to create a BackendUser instance from.
     * @returns {BackendUser} The BackendUser instance created from the raw JSON object.
     */
    static fromJSON(rawObject) 
    {
        if (!rawObject) return null;
        if (rawObject instanceof BackendUser) return rawObject;

        const parsedProfiles = Array.isArray(rawObject.profiles)
        ? rawObject.profiles.map(p => p instanceof Profile ? p : Profile.fromJSON(p))
        : [];

        return new BackendUser(
            rawObject.email, 
            rawObject.phone, 
            rawObject.full_name, 
            parsedProfiles, 
            rawObject.password 
        );
    }

    /**
     * Converts the BackendUser instance to a JSON object.
     * @returns {Object} The JSON object representing the BackendUser instance.
     */
    toJSON() 
    {
        return {
            ...super.toJSON(), // take all the fields from the UserInfo class
            password: this.password // add the password (it exists only in the BackendUser class)
        };
    }

}

export class FakeBackend extends Interface_BackendAPI 
{
    constructor() 
    {
        super();
        this.DB_STORAGE_NAME = "fake_users_db";
        this.MEDIA_DB_STORAGE_NAME = "fake_media_db";
        this.SESSION_COOKIE_NAME = "current_logged_in_user";
        
        // Initialize the cookie database with mock data if it does not exist
        this._initDatabase();
    }


    /**
     * Internal helper to retrieve all registered users from the database storage.
     * @private
     * @returns {Array<UserInfo>} List of UserInfo instances.
     */
    _getUsersFromStorage() 
    {
        const storageData = localStorage.getItem(this.DB_STORAGE_NAME);
        if (!storageData) return [];

        try 
        {
            const rawUsers = JSON.parse(storageData); 
            return rawUsers.map(u => BackendUser.fromJSON(u));
        }
        catch (e)
        {
            console.error("Failed to parse database from localStorage:", e);
            return [];
        }
    }

    /**
     * Internal helper to retrieve all media from the database storage.
     * @private
     * @returns {Array<MediaItem>} List of MediaItem instances.
     */

    _getMediaFromStorage()
    {
        const storageData = localStorage.getItem(this.MEDIA_DB_STORAGE_NAME);
        if (!storageData) return [];
        try
        {
            const rawMedia = JSON.parse(storageData);
            return rawMedia.map(m => MediaItem.fromJSON(m));
        }
        catch (e)
        {
            console.error("Failed to parse media from localStorage:", e);
            return [];
        }
    }

    /**
     * Internal helper to save the entire users array back into the database storage.
     * @private
     * @param {Array<Object>} users_list - The updated users list.
     */
    _saveUsersToStorage(users_list) 
    {
        localStorage.setItem(this.DB_STORAGE_NAME, JSON.stringify(users_list));
    }

    /**
     * Internal helper to save the entire media array back into the database storage.
     * @private
     * @param {Array<Object>} media_items - The updated media list.
     */
    _saveMediaToStorage(media_items)
    {
        const plainMedia = media_items.map(m => ({ ...m })); 
        localStorage.setItem(this.MEDIA_DB_STORAGE_NAME, JSON.stringify(plainMedia));//save the media items to the database storage 
    }

    /**
     * Populates the database storage with initial mock data for testing purposes.
     * @private
     */
    _initDatabase() 
    {
        if (!localStorage.getItem(this.DB_STORAGE_NAME))
        {
            const fake_profiles = [new Profile(1, "Dad", "avatar1.png"), new Profile(2, "Mom", "avatar2.png")];
            const initialUsers = 
            [
                new BackendUser("test@gmail.com", "0501234567", "Test User", fake_profiles, "123456789")
            ];
            this._saveUsersToStorage(initialUsers);
        }
        if (!localStorage.getItem(this.MEDIA_DB_STORAGE_NAME))
        {
            const initialMedia = 
            [
                new MediaItem(1, "Black Rabbit", "Black_Rabbit.png", 0), 
                new MediaItem(2, "Courtroom Queens", "Courtroom_Queens.png", 0),
                new MediaItem(3, "East Side", "East_Side.png", 0),
                new MediaItem(4, "Griselda", "Griselda.png", 0),
                new MediaItem(5, "Nobody Wants This", "Nobody_Wants_This.png", 0),
                new MediaItem(6, "Off-Road", "OFFROAD.png", 0),
                new MediaItem(7, "Running Point", "Running_Point.png", 0),
                new MediaItem(8, "The Spy", "The_Spy.png", 0),
                new MediaItem(9, "Zero Day", "Zero_Day.png", 0),
            ];
            this._saveMediaToStorage(initialMedia);
        }
    }

    /**
     * Step 1A: Email Authentication Attempt
     */
    async attemptLoginByEmail(email, password) 
    {
        const users = this._getUsersFromStorage();
        // Search the storage for a matching email and password combination
        const user = users.find(u => u.email === email && u.password === password);

        if (!user)
        {
            return { success: false, message: "Invalid email or password." };
        }

        // Store the user's email as the active identifier in the session cookie
        document.cookie = `${this.SESSION_COOKIE_NAME}=${encodeURIComponent(email)}; path=/`;
        return { success: true };
    }

    /**
     * Step 1B: Phone Authentication Attempt
     */
    async attemptLoginByPhone(phone, password)
    {
        const users = this._getUsersFromStorage();
        // Search the storage for a matching phone and password combination
        const user = users.find(u => u.phone === phone && u.password === password);

        if (!user)
        {
            return { success: false, message: "Invalid phone number or password." };
        }

        // Store the user's phone as the active identifier in the session cookie
        document.cookie = `${this.SESSION_COOKIE_NAME}=${encodeURIComponent(phone)}; path=/`;
        return { success: true };
    }

    /**
     * User Registration
     */
    async register(email, phone, password, full_name) 
    {
        const users = this._getUsersFromStorage();

        // Check if a user with the same unique identifiers already exists
        if (users.some(u => u.email === email || u.phone === phone))
        {
            return { success: false, message: "User already exists." };
        }

        const firstName = full_name && full_name.includes(" ") ? full_name.split(" ")[0] : (full_name || "User");

        const newUser = new BackendUser(email, phone, full_name, [new Profile(1, firstName)], password);

        users.push(newUser);

        this._saveUsersToStorage(users);
        return { success: true };
    }

    /**
     * Step 2: Secured User Info Fetching
     */
    async fetchUserInfo() 
    {
        const userKey = this._getCookie(this.SESSION_COOKIE_NAME);
        if (!userKey)
        {
            return { success: false, message: "Access Denied. No active session." };
        }

        const users = this._getUsersFromStorage();
        // Locate the matching record using the active session key (isolated lookup)
        const dbUser = users.find(u => u.email === userKey || u.phone === userKey);

        if (!dbUser)
        {
            return { success: false, message: "User not found." };
        }

        return { success: true, data: dbUser.toUserInfo() };//convert the BackendUser to a UserInfo instance (without the password)
    }

    /**
     * Profile Synchronization
     */
    async updateProfiles(profiles) 
    {
        const userKey = this._getCookie(this.SESSION_COOKIE_NAME);
        if (!userKey) return { success: false, message: "Not logged in." };

        const users = this._getUsersFromStorage();
        const userIndex = users.findIndex(u => u.email === userKey || u.phone === userKey);

        if (userIndex !== -1) 
        {
            users[userIndex].profiles = profiles.map(p => p instanceof Profile ? p : Profile.fromJSON(p));
            this._saveUsersToStorage(users);
            return { success: true };
        }

        return { success: false, message: "User not found." };
    }

    /**
     * Client Environment Session Inspector
     */
    async getCurrentSession() 
    {
        const userKey = this._getCookie(this.SESSION_COOKIE_NAME);
        if (!userKey) return null;

        const users = this._getUsersFromStorage();
        const dbUser = users.find(u => u.email === userKey || u.phone === userKey);

        if (!dbUser) return null;

        return dbUser.toUserInfo();//convert the BackendUser to a UserInfo instance (without the password)
    }

    /**
     * Session Termination
     */
    logout() 
    {
        // Clears only the active session tracking cookie, leaving the database cookie intact
        document.cookie = `${this.SESSION_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    async getMediaByID(mediaID)
    {
        const media = this._getMediaFromStorage();
        const mediaItem = media.find(m => m.id === Number(mediaID));
        if (!mediaItem) return { success: false, message: "Media not found." };
        return { success: true, data: mediaItem };
    }

    async toggleMediaLike(profileID, mediaID) // make a like to a media item
    {
        // 1. check the session - verify that the user is logged in and get the key (email/phone)
        const userKey = this._getCookie(this.SESSION_COOKIE_NAME);
        if (!userKey) return { success: false, message: "Not logged in." };

        // 2. get all the users and media from the storage
        const users = this._getUsersFromStorage();
        const media = this._getMediaFromStorage();

        // 3. find the specific user from the general array (to save the changes)
        const user = users.find(u => u.email === userKey || u.phone === userKey);
        if (!user) return { success: false, message: "User not found." };

        // 4. find the specific profile from the user
        const profile = user.profiles.find(p => p.id === Number(profileID));
        if (!profile) return { success: false, message: "Profile not found." };

        // 5. find the specific media item
        const mediaItem = media.find(m => m.id === Number(mediaID));
        if (!mediaItem) return { success: false, message: "Media not found." };

        const numericMediaID = Number(mediaID);

        // 6. perform the toggle operation on the profile's Set
        if (profile.wasLiked_Media_IDs.has(numericMediaID)) // remove the like if it already exists
        {
            profile.wasLiked_Media_IDs.delete(numericMediaID);
            mediaItem.likes = Math.max(0, mediaItem.likes - 1);
        }
        else // add the like if it doesn't exist
        {
            profile.wasLiked_Media_IDs.add(numericMediaID);
            mediaItem.likes++;
        }

        // 7. now both 'media' and 'users' are updated to the correct objects!
        this._saveMediaToStorage(media);
        this._saveUsersToStorage(users); // now the users are defined and will save the entire array

        return { success: true };
    }

    /**
     * Internal utility method to read a specific cookie value by its key.
     * @private
     * @param {string} name - The cookie key name.
     * @returns {string|null} The unescaped cookie value string, or null if not found.
     */
    _getCookie(name) 
    {
        const cookies = document.cookie.split('; ');
        const cookie = cookies.find(row => row.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    }
}