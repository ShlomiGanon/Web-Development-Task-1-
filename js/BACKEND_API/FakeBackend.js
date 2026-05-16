import { Interface_BackendAPI, UserInfo, Profile } from './backend-interface.js';


class BackendUser extends UserInfo 
{
    constructor(email, phone, full_name, rawProfiles = [], password) 
    {
        super(email, phone, full_name, rawProfiles);
        this.password = password;
    }
    
    toUserInfo()
    {
        return new UserInfo(this.email, this.phone, this.full_name, this.profiles);
    }

    static fromJSON(rawObject) 
    {
        if (!rawObject) return null;
        return new BackendUser(
            rawObject.email, 
            rawObject.phone, 
            rawObject.full_name, 
            rawObject.profiles, 
            rawObject.password 
        );
    }

}

export class FakeBackend extends Interface_BackendAPI 
{
    constructor() 
    {
        super();
        // Cookie name that acts as our local database storage
        this.DB_COOKIE_NAME = "fake_backend_db";
        // Cookie name that holds the identifier of the currently authenticated user
        this.SESSION_COOKIE_NAME = "current_logged_in_user";
        
        // Initialize the cookie database with mock data if it does not exist
        this._initDatabase();
    }

    /**
     * Internal helper to retrieve all registered users from the database cookie.
     * @private
     * @returns {Array<Object>} List of users.
     */
    /**
     * Internal helper to retrieve all registered users from the database cookie.
     * @private
     * @returns {Array<UserInfo>} List of UserInfo instances.
     */
    _getUsersFromCookie() 
    {
        const cookieData = this._getCookie(this.DB_COOKIE_NAME);
        if (!cookieData) return [];

        try 
        {
            const rawUsers = JSON.parse(cookieData); 
            return rawUsers.map(u => BackendUser.fromJSON(u));
        }
        catch (e)
        {
            console.error("Failed to parse database cookie:", e);
            return [];
        }
    }

    /**
     * Internal helper to save the entire users array back into the database cookie.
     * @private
     * @param {Array<Object>} users - The updated users list.
     */
    _saveUsersToCookie(users) 
    {
        const secureJsonString = encodeURIComponent(JSON.stringify(users));
        document.cookie = `${this.DB_COOKIE_NAME}=${secureJsonString}; path=/; max-age=31536000`; // Valid for 1 year
    }

    /**
     * Populates the database cookie with initial mock data for testing purposes.
     * @private
     */
    _initDatabase() 
    {
        if (!this._getCookie(this.DB_COOKIE_NAME))
        {
            const fake_profiles = [new Profile(1, "Dad", "avatar1.png"), new Profile(2, "Mom", "avatar2.png")];
            const initialUsers = 
            [
                new BackendUser("test@gmail.com", "0501234567", "Test User", fake_profiles, "123456789")
            ];
            this._saveUsersToCookie(initialUsers);
        }
    }

    /**
     * Step 1A: Email Authentication Attempt
     */
    async attemptLoginByEmail(email, password) 
    {
        const users = this._getUsersFromCookie();
        // Search the cookie registry for a matching email and password combination
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
        const users = this._getUsersFromCookie();
        // Search the cookie registry for a matching phone and password combination
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
        const users = this._getUsersFromCookie();

        // Check if a user with the same unique identifiers already exists
        if (users.some(u => u.email === email || u.phone === phone))
        {
            return { success: false, message: "User already exists." };
        }

        const firstName = full_name && full_name.includes(" ") ? full_name.split(" ")[0] : (full_name || "User");

        const newUser = new BackendUser(email, phone, full_name, [new Profile(1, firstName)], password);

        users.push(newUser);

        this._saveUsersToCookie(users);
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

        const users = this._getUsersFromCookie();
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

        const users = this._getUsersFromCookie();
        const userIndex = users.findIndex(u => u.email === userKey || u.phone === userKey);

        if (userIndex !== -1) 
        {
            users[userIndex].profiles = profiles.map(p => p instanceof Profile ? p : Profile.fromJSON(p));
            this._saveUsersToCookie(users);
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

        const users = this._getUsersFromCookie();
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