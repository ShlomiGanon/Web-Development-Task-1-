/* eslint-disable no-unused-vars */
const express = require('express');
const { User, UserProfile, Media } = require('./entities.js');
const MemoryStorage = require('./storage/memory-storage.js');
const { SessionManager } = require('./season-manager.js'); 
const path = require('path');

// Importing validation helper functions
const { 
    Is_Valid_Name, 
    Is_Valid_Email, 
    Is_Valid_Phone, 
    Is_Valid_Password 
} = require('./auth.js');

const app = express();
const sessionManager = new SessionManager();
const storage = new MemoryStorage();

// Initialize media storage on startup
init_storage(storage);

app.use(express.json());

//--- Static routes ---
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/html', express.static(path.join(__dirname, '../html')));

//--- HTML routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';


//-------------- ROUTES --------------

/**
 * @route POST /register
 * @description Register a new user with strict payload validation
 * @param {Object} req.body
 * @param {string} req.body.email
 * @param {string} req.body.phone
 * @param {string} req.body.fullName
 * @param {string} req.body.password
 * @returns {Object} {success: boolean, message?: string, data?: {sessionToken: string}}
 */
app.post('/register', async (req, res) => {
    try {
        const { email, phone, fullName, password } = req.body;
        const required = ['email', 'phone', 'fullName', 'password'];
        const missing = required.filter(field => !req.body[field]);

        if (missing.length > 0) {
            return res.json({ success: false, message: 'Missing required fields: ' + missing.join(', ') });
        }

        // Validate email format
        if (!Is_Valid_Email(email)) {
            return res.json({ success: false, message: 'Invalid email format structure' });
        }

        // Validate phone format
        if (!Is_Valid_Phone(phone)) {
            return res.json({ success: false, message: 'Invalid phone format (Must be a valid Israeli mobile number starting with 05)' });
        }

        // Validate password structure and lengths
        if (!Is_Valid_Password(password)) {
            return res.json({ success: false, message: 'Password does not meet required criteria or length limits' });
        }

        // Extract and validate first/last name from fullName
        const nameParts = fullName.trim().split(" ");
        if (nameParts.length !== 2)
        {
            return res.json({ success: false, message: 'Full name must contain only one space between first and last name' });
        }
        const first_name = nameParts[0];
        const last_name = nameParts[1];

        if (!first_name || !last_name) 
        {
            return res.json({ success: false, message: 'Full name must contain both first and last name' });
        }

        // Validate individual name tokens using auth rules (ensuring letters only)
        if (!Is_Valid_Name(first_name) || !Is_Valid_Name(last_name)) 
        {
            return res.json({ success: false, message: 'Names must contain english alphabetic characters only' });
        }

        const newUser = new User(undefined, email, phone, fullName, [new UserProfile(0, first_name )], password);
        const storageRes = await storage.registerUser(newUser);

        if (!storageRes.success) 
        {
            return res.json({ success: false, message: storageRes.message });
        }

        return res.json({ success: true});
    } catch (error)
    {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /email-login
 * @description Login a user via email
 * @param {Object} req.body
 * @param {string} req.body.email
 * @param {string} req.body.password
 * @returns {Object} {success: boolean, message?: string, data?: {sessionToken: string}}
 */
app.post('/email-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
        {
            return res.json({ success: false, message: 'Missing email or password' });
        }

        if (!Is_Valid_Email(email))
        {
            return res.json({ success: false, message: 'Invalid email format' });
        }

        const userRes = await storage.getUserByEmail(email);
        if (!userRes.success) 
        {
            //console.log(`user not found: ${email} , response: ${userRes.message}`);
            return res.json({ success: false, message: userRes.message });
        }

        if (userRes.data.password !== password) 
        {
            //console.log(`mismatch password: ${userRes.data.password} !== ${password}`);
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        const sessionToken = sessionManager.addSession(userRes.data.id);
        console.log(`login: id: [${userRes.data.id}] , token: [${sessionToken}]`);
        return res.json({ success: true, data: {sessionToken: sessionToken } });
    }
    catch (error)
    {
        console.error(`error in email-login: ${error.message}`);
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /phone-login
 * @description Login a user via phone number
 * @param {Object} req.body
 * @param {string} req.body.phone
 * @param {string} req.body.password
 * @returns {Object} {success: boolean, message?: string, data?: {sessionToken: string}}
 */
app.post('/phone-login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) {
            return res.json({ success: false, message: 'Missing phone or password' });
        }

        if (!Is_Valid_Phone(phone)) {
            return res.json({ success: false, message: 'Invalid phone format' });
        }

        const userRes = await storage.getUserByPhone(phone);
        if (!userRes.success) {
            return res.json({ success: false, message: 'Invalid phone or password' });
        }

        if (userRes.data.password !== password) {
            return res.json({ success: false, message: 'Invalid phone or password' });
        }

        const sessionToken = sessionManager.addSession(userRes.data.id);
        return res.json({ success: true, data: {sessionToken: sessionToken } });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /get-user-info
 * @description Fetch active user information using session token
 * @param {Object} req.body
 * @param {string} req.body.sessionToken
 * @returns {Object} {success: boolean, message?: string, data?: User}
 */
app.post('/get-user-info', async (req, res) => {
    try {
        const { sessionToken } = req.body;
        if (sessionToken === undefined) return res.json({ success: false, message: 'Session token is required' });

        const userId = sessionManager.getUserIdByToken(sessionToken);
        if (userId === undefined) 
        {
            return res.json({ success: false, message: 'Invalid or expired session' });
        }

        const userRes = await storage.getUserById(userId);
        if (!userRes.success) return res.json({ success: false, message: userRes.message });

        return res.json({ success: true, data: userRes.data.toJSON() });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /save-profiles
 * @description Sync and update user profiles
 * @param {Object} req.body
 * @param {string} req.body.sessionToken
 * @param {Array} req.body.profiles
 * @returns {Object} {success: boolean, message?: string, data?: Array<UserProfile>}
 */
app.post('/save-profiles', async (req, res) => 
    {
        try 
        {
            const { sessionToken, profiles } = req.body;
            if (!sessionToken) return res.json({ success: false, message: 'Session token is required' });
    
            const userId = sessionManager.getUserIdByToken(sessionToken);
            if (userId === undefined) 
            {
                return res.json({ success: false, message: 'Invalid or expired session' });
            }
    
            // Convert incoming data to UserProfile instances
            const profileInstances = profiles.map(p => new UserProfile(p.id, p.name, p.imageName, p.wasLiked_Media_IDs, p.LastWatched_Media_IDs));
            
            // 1. Fetch current active profiles from the server storage
            const existingProfilesRes = await storage.getUserProfiles(userId);
            if (!existingProfilesRes.success) return res.json({ success: false, message: existingProfilesRes.message });
            
            const currentServerProfiles = existingProfilesRes.data || [];
    
            // 2. Deletion Stage: Identify profiles removed by the client
            const incomingIds = profileInstances.map(p => p.id).filter(id => id !== undefined && id !== null);
            
            for (const existingProf of currentServerProfiles) 
            {
                // If an existing server profile ID is missing from the incoming client array, it was deleted
                if (!incomingIds.includes(existingProf.id)) 
                {
                    const deleteRes = await storage.deleteProfile(userId, existingProf.id);
                    if (!deleteRes.success) return res.json({ success: false, message: deleteRes.message });
                }
            }
    
            // 3. Upsert Stage: Add new profiles or update existing ones
            for (const prof of profileInstances) 
            {
                if (prof.id === undefined || prof.id === null) 
                {
                    const addRes = await storage.addProfile(userId, prof);
                    if (!addRes.success) return res.json({ success: false, message: addRes.message });
                } 
                else 
                {
                    const updateRes = await storage.updateProfile(userId, prof);
                    if (!updateRes.success) return res.json({ success: false, message: updateRes.message });
                }
            }
    
            // 4. Final Sync: Fetch the freshly updated array from storage
            const finalProfiles = await storage.getUserProfiles(userId);
            if (!finalProfiles.success) return res.json({ success: false, message: finalProfiles.message });
            
            // Serialize data to plain JSON objects before sending back to client
            const serializedProfiles = finalProfiles.data.map(p => p.toJSON ? p.toJSON() : p);
    
            return res.json({ success: true, data: serializedProfiles });
        } 
        catch (error) 
        {
            return res.json({ success: false, message: error.message });
        }
    });

/**
 * @route POST /logout
 * @description Terminate user session
 * @param {Object} req.body
 * @param {string} req.body.sessionToken
 * @returns {Object} {success: boolean}
 */
app.post('/logout', (req, res) => 
{
    try
    {
        const { sessionToken } = req.body;
        if (sessionToken) 
        {
            sessionManager.removeSession(sessionToken);
        }
        return res.json({ success: true });
    }
    catch (error)
    {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /get-media-by-id
 * @description Retrieve a single media item by ID
 * @param {Object} req.body
 * @param {string|number} req.body.mediaID
 * @returns {Object} {success: boolean, message?: string, data?: Media}
 */
app.post('/get-media-by-id', async (req, res) => {
    try {
        const { mediaID } = req.body;
        if (mediaID === undefined) return res.json({ success: false, message: 'Media ID is required' });

        const mediaRes = await storage.getMediaById(Number(mediaID));
        if (!mediaRes.success) return res.json({ success: false, message: mediaRes.message });

        return res.json({ success: true, data: mediaRes.data });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /get-all-media-items
 * @description Retrieve all available media items
 * @returns {Object} {success: boolean, data: Array<Media>}
 */
app.post('/get-all-media-items', async (req, res) => {
    try {
        const mediaRes = await storage.getAllMedia();
        return res.json({ success: true, data: mediaRes.data || [] });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /toggle-media-like
 * @description Toggle like status of a media item for a specific profile
 * @param {Object} req.body
 * @param {string} req.body.sessionToken
 * @param {string|number} req.body.profileID
 * @param {string|number} req.body.mediaID
 * @returns {Object} {success: boolean, message?: string, data?: Object}
 */
app.post('/toggle-media-like', async (req, res) => {
    try {
        const { sessionToken, profileID, mediaID } = req.body;
        if (!sessionToken) return res.json({ success: false, message: 'Session token is required' });

        const userId = sessionManager.getUserIdByToken(sessionToken);
        if (userId === undefined || userId === null) {
            return res.json({ success: false, message: 'Invalid or expired session' });
        }

        const likeRes = await storage.toggleMediaLike(userId, profileID, mediaID);
        if (!likeRes.success) return res.json({ success: false, message: likeRes.message });

        return res.json({ success: true, message: likeRes.message, data: likeRes.data });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
});

/**
 * @route POST /select-media-item
 * @description Select a media item and push it into watch history
 * @param {Object} req.body
 * @param {string} req.body.sessionToken
 * @param {string|number} req.body.profileID
 * @param {string|number} req.body.mediaID
 * @returns {Object} {success: boolean, message?: string, data?: UserProfile}
 */
app.post('/select-media-item', async (req, res) => {
    try {
        const { sessionToken, profileID, mediaID } = req.body;
        if (!sessionToken) return res.json({ success: false, message: 'Session token is required' });

        const userId = sessionManager.getUserIdByToken(sessionToken);
        if (userId === undefined) {
            return res.json({ success: false, message: 'Invalid or expired session' });
        }

        const watchRes = await storage.addMediaToWatchHistory(userId, profileID, mediaID);
        if (!watchRes.success) return res.json({ success: false, message: watchRes.message });

        return res.json({ success: true, data: watchRes.data.profile.toJSON() });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
});


//-------------- SERVER --------------
app.listen(port, async () => 
{
    try {
        const seedUser = new User(undefined, 'shlomi@mail.com', '0521234567', 'Shlomi Ganon', [], '1234');
        const response = await storage.registerUser(seedUser);
        if (!response.success)
        {
            console.warn("Seed user warning: " + response.message);
        }
        else
        {
            console.log(`seed user registered: ${seedUser.email}`);
        }
    } catch (err) {
        console.error("Failed to seed initial user:", err.message);
    }
    console.log(`Server is running on http://${host}:${port}`);
});


//-------------- INITIALIZATION --------------
async function init_storage(storage) 
{
    if (!storage) throw new Error("Storage is not initialized");
    const initialMedia = [
        new Media(undefined, "Black Rabbit", "Black_Rabbit.jpg"),
        new Media(undefined, "Courtroom Queens", "Courtroom_Queens.jpg"),
        new Media(undefined, "East Side", "East_Side.jpg"),
        new Media(undefined, "Griselda", "Griselda.jpg"),
        new Media(undefined, "Nobody Wants This", "Nobody_Wants_This.jpg"),
        new Media(undefined, "Off-Road", "OFFROAD.jpg"),
        new Media(undefined, "Running Point", "Running_Point.jpg"),
        new Media(undefined, "The Spy", "The_Spy.jpg"),
        new Media(undefined, "Zero Day", "Zero_Day.jpg"),
    ];

    for (const m of initialMedia) {
        const response = await storage.addMedia(m);
        if (!response.success) throw new Error("Failed to add media to storage: " + response.message);
    }
}