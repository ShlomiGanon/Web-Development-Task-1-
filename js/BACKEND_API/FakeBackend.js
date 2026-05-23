import { Interface_BackendAPI, UserInfo, Profile, MediaItem } from './backend-interface.js';


class BackendUser extends UserInfo 
{
    constructor(email, phone, full_name, rawProfiles, password) 
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
        const clonedProfiles = this.profiles.map(p => Profile.fromJSON(p.toJSON()));
        return new UserInfo(this.email, this.phone, this.full_name, clonedProfiles);
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
        
        // Initialize the local database with mock data if it does not exist
        this._initDatabase();
    }


    //-------------- HELPER FUNCTIONS --------------


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

    _saveUsersToStorage(usersList) 
    {
        const plainUsers = usersList.map(u => typeof u.toJSON === 'function' ? u.toJSON() : u);
        localStorage.setItem(this.DB_STORAGE_NAME, JSON.stringify(plainUsers));
    }

    _saveMediaToStorage(mediaItems)
    {
        const plainMedia = mediaItems.map(m => typeof m.toJSON === 'function' ? m.toJSON() : { ...m });
        localStorage.setItem(this.MEDIA_DB_STORAGE_NAME, JSON.stringify(plainMedia));
    }

    _initDatabase() 
    {
        if (!localStorage.getItem(this.DB_STORAGE_NAME))
        {
            const fakeProfiles = [new Profile(1, "Dad", "avatar1.png"), new Profile(2, "Mom", "avatar2.png")];
            const initialUsers = [
                new BackendUser("test@gmail.com", "0501234567", "Test User", fakeProfiles, "123456789")
            ];
            this._saveUsersToStorage(initialUsers);
        }
        if (!localStorage.getItem(this.MEDIA_DB_STORAGE_NAME))
        {
            const initialMedia = [
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


    //-----------------------------------------------------------

    /**
     * Step 1A: Email Authentication Attempt
     * Returns a session token (email) upon successful verification.
     */
    async attemptLoginByEmail(email, password) 
    {
        const users = this._getUsersFromStorage();
        const user = users.find(u => u.email === email && u.password === password);

        if (!user)
        {
            return { success: false, message: "Invalid email or password." };
        }

        // Return the token to the client instead of setting cookies directly
        return { success: true, sessionToken: email };
    }

    /**
     * Step 1B: Phone Authentication Attempt
     * Returns a session token (phone) upon successful verification.
     */
    async attemptLoginByPhone(phone, password)
    {
        const users = this._getUsersFromStorage();
        const user = users.find(u => u.phone === phone && u.password === password);

        if (!user)
        {
            return { success: false, message: "Invalid phone number or password." };
        }

        // Return the token to the client instead of setting cookies directly
        return { success: true, sessionToken: phone };
    }

    /**
     * User Registration
     */
    async register(email, phone, password, full_name) 
    {
        const users = this._getUsersFromStorage();

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
     * Uses the explicitly passed sessionToken to identify the user.
     */
    async fetchActiveUserInfo(sessionToken) 
    {
        if (!sessionToken)
        {
            return { success: false, message: "Access Denied. No session token provided." };
        }

        const users = this._getUsersFromStorage();
        const dbUser = users.find(u => u.email === sessionToken || u.phone === sessionToken);

        if (!dbUser)
        {
            return { success: false, message: "User not found or session invalid." };
        }

        return { success: true, data: dbUser.toUserInfo() };
    }

    /**
     * Profile Synchronization
     * Uses the explicitly passed sessionToken to identify the user.
     */
    async saveProfiles(sessionToken, profiles) 
    {
        if (!sessionToken) 
        {
            return { success: false, message: "Access Denied. No session token provided." };
        }

        const users = this._getUsersFromStorage();
        const userIndex = users.findIndex(u => u.email === sessionToken || u.phone === sessionToken);

        if (userIndex !== -1) 
        {
            users[userIndex].profiles = profiles.map(p => 
            {
                const rawData = (typeof p.toJSON === 'function') ? p.toJSON() : p;
                return Profile.fromJSON(rawData);
            });
            
            this._saveUsersToStorage(users);
            return { success: true };
        }

        return { success: false, message: "User not found." };
    }

    /**
     * Session Termination
     * Handles the logout verification on the server side using the token.
     */
    async logout(sessionToken) 
    {
        if (!sessionToken)
        {
            return { success: false, message: "No active session token to revoke." };
        }
        
        // In a real DB we would invalidate the token here. 
        // For FakeBackend, we just return a successful response to the client.
        return { success: true, message: "Session successfully revoked on server." };
    }

    /**
     * Fetch Media Item by ID
     */
    async getMediaByID(mediaID)
    {
        const media = this._getMediaFromStorage();
        const mediaItem = media.find(m => m.id === Number(mediaID));
        
        if (!mediaItem) 
        {
            return { success: false, message: "Media not found." };
        }
        
        return { success: true, data: mediaItem };
    }

    /**
     * Toggle Media Like
     * Uses the explicitly passed sessionToken to identify the user.
     */
    async toggleMediaLike(sessionToken, profileID, mediaID) 
    {
        if (!sessionToken) 
        {
            return { success: false, message: "Access Denied. Not logged in." };
        }

        const users = this._getUsersFromStorage();
        const media = this._getMediaFromStorage();

        const user = users.find(u => u.email === sessionToken || u.phone === sessionToken);
        if (!user) 
        {
            return { success: false, message: "User not found." };
        }

        const profile = user.profiles.find(p => p.id === Number(profileID));
        if (!profile) 
        {
            return { success: false, message: "Profile not found." };
        }

        const mediaItem = media.find(m => m.id === Number(mediaID));
        if (!mediaItem) 
        {
            return { success: false, message: "Media not found." };
        }

        const numericMediaID = Number(mediaID);

        if (profile.wasLiked_Media_IDs.has(numericMediaID)) 
        {
            profile.wasLiked_Media_IDs.delete(numericMediaID);
            mediaItem.likes = Math.max(0, mediaItem.likes - 1);
        }
        else 
        {
            profile.wasLiked_Media_IDs.add(numericMediaID);
            mediaItem.likes++;
        }

        this._saveMediaToStorage(media);
        this._saveUsersToStorage(users); 

        return { success: true };
    }
}