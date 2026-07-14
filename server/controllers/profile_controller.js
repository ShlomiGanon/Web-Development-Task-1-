const mongoose = require('mongoose');
const Profile = require('../models/profile');
const User = require('../models/user');
const Content = require('../models/content');
const Episode = require('../models/episode');
const { MAX_LAST_WATCHED_CONTENT_LIMIT } = require('../scripts/constants');
const my_logger = require('../scripts/my_logger');
const { safe_user } = require('./user_controller');
const { toEpisodeSummary } = require('./content_controller');

/**
 * Helper to fetch the current list of profiles belonging to a user.
 */
const fetchUserProfiles = async (userId) =>
{
    return await Profile.find({ user_id: userId });
}

/**
 * Helper to convert a full Profile document into a lightweight object
 * containing only the fields exposed to the client.
 */
const toProfileSummary = (profile) =>
{
    return {
        id: profile._id,
        profileName: profile.profile_name,
        age: profile.age,
        ImageName: profile.image_name
    };
}

const toLastWatchedSummary = (lastWatched) =>
{
    return lastWatched.map((entry) => ({
        episode_id: entry.episode_id,
        content_id: entry.content_id
    }));
}

/**
 * Helper to convert an array of full Profile documents into an array of lightweight summaries.
 */
const toProfileSummaryList = (profiles) =>
{
    return profiles.map(toProfileSummary);
}

/**
 * Create a new default profile for the authenticated user.
 * Delegates to User.addProfile to enforce MAX_PROFILES_LIMIT and keep profile_ids in sync.
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, profiles: Array }
const createProfile = async (req, res) =>
{
    const userId = req.target_user_id;

    try
    {
        const user = await User.findById(userId);

        if (!user)
        {
            my_logger.ConsoleLog(`Failed to create profile, user not found. [user_id: ${userId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('createProfile', 'User not found.', { "user_id": userId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "User not found", profiles: [] });
        }
        let newProfile;
        try
        {

            newProfile = await user.addProfile();
        }
        catch (error)
        {
            my_logger.ConsoleLog(`Failed to add new profile, error: ${error}`, my_logger.Log_Level.ERROR);
            my_logger.OperationLog('createProfile', 'Failed to add new profile.', { "user_id": userId, "error": error }, my_logger.Log_Level.ERROR);
            return res.json({ success: false, message: error.message || "fail to add new profile", profiles: toProfileSummaryList(await fetchUserProfiles(userId)) });
        }

        const profiles = await fetchUserProfiles(userId);

        res.json({ success: true, message: "Profile created successfully", profiles: toProfileSummaryList(profiles) });
        my_logger.ConsoleLog(`Profile created successfully. [user_id: ${userId}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('createProfile', 'Profile created successfully.', { "user_id": userId, "new_profile": toProfileSummary(newProfile) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error creating profile: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('createProfile', 'Error creating profile.', { "user_id": userId, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: error.message || "Internal server error", profiles: [] });
    }
}

/**
 * Delete a specific profile.
 * Delegates to User.removeProfile to keep profile_ids in sync and enforce the
 * "at least one profile" rule. Relies on authorizeProfileAccess for ownership (req.profile).
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, profiles: Array }
const deleteProfile = async (req, res) =>
{
    const userId = req.target_user_id;
    const profileId = req.profile._id;

    try
    {
        const user = await User.findById(userId);

        if (!user)
        {
            my_logger.ConsoleLog(`Failed to delete profile, user not found. [user_id: ${userId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('deleteProfile', 'User not found.', { "user_id": userId, "profile_id": profileId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "User not found", profiles: [] });
        }
        try
        {
            await user.removeProfile(profileId);
        }
        catch (error)
        {
            my_logger.ConsoleLog(`Failed to delete profile, error: ${error}`, my_logger.Log_Level.ERROR);
            my_logger.OperationLog('deleteProfile', 'Failed to delete profile.', { "user_id": userId, "profile_id": profileId, "error": error }, my_logger.Log_Level.ERROR);
            return res.json({ success: false, message: error.message || "fail to delete profile", profiles: toProfileSummaryList(await fetchUserProfiles(userId)) });
        }
        const profiles = await fetchUserProfiles(userId);

        res.json({ success: true, message: "Profile deleted successfully", profiles: toProfileSummaryList(profiles) });
        my_logger.ConsoleLog(`Profile deleted successfully. [user_id: ${userId}, profile_id: ${profileId}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('deleteProfile', 'Profile deleted successfully.', { "user_id": userId, "profile_id": profileId }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error deleting profile: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('deleteProfile', 'Error deleting profile.', { "user_id": userId, "profile_id": profileId, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: error.message || "Internal server error", profiles: [] });
    }
}

/**
 * Update profile details (profileName, age, ImageName).
 * Relies on authorizeProfileAccess having already verified ownership (req.profile).
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { profileName?: String, age?: Number, ImageName?: String }
//res.json: { success: boolean, message: string, profiles: Array }
const updateProfile = async (req, res) =>
{
    const userId = req.target_user_id;
    const profile = req.profile;

    try
    {
        const { profileName, age, ImageName } = req.body;
        const old_data = { profileName: profile.profile_name, age: profile.age, ImageName: profile.image_name };
        const changes = {};

        if (profileName !== undefined)
        {
            profile.profile_name = profileName;
            changes.profileName = profileName;
        }

        if (age !== undefined)
        {
            profile.age = age;
            changes.age = age;
        }

        if (ImageName !== undefined)
        {
            profile.image_name = ImageName;
            changes.ImageName = ImageName;
        }

        await profile.save();

        const profiles = await fetchUserProfiles(userId);

        res.json({ success: true, message: "Profile updated successfully", profiles: toProfileSummaryList(profiles) });
        my_logger.ConsoleLog(`Profile updated successfully. [user_id: ${userId}, profile_id: ${profile._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('updateProfile', 'Profile updated successfully.', { "user_id": userId, "profile_id": profile._id, "old_data": old_data, "changes": changes }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating profile: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('updateProfile', 'Error updating profile.', { "user_id": userId, "profile_id": profile._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", profiles: [] });
    }
}

/**
 * Get a specific profile (if profileId is provided) or all profiles for the authenticated user.
 * When profileId is provided, relies entirely on authorizeProfileAccess having already
 * verified ownership and attached the document (req.profile) - no lookup happens here.
 * Always returns lightweight profile summaries, not full documents - use getProfileDetails for the full document.
 * On any exception, returns an empty profiles list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, profiles?: Array, profile?: Object }
const getProfile = async (req, res) =>
{
    const userId = req.target_user_id;

    try
    {
        if (!req.params.profileId)
        {
            const profiles = await fetchUserProfiles(userId);
            res.json({ success: true, message: "Profiles retrieved successfully", profiles: toProfileSummaryList(profiles) });
            my_logger.ConsoleLog(`Profiles retrieved successfully. [user_id: ${userId}]`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('getProfile', 'Profiles retrieved successfully.', { "user_id": userId, "count": profiles.length }, my_logger.Log_Level.INFO);
            return;
        }

        const profile = req.profile;

        res.json({ success: true, message: "Profile retrieved successfully", profile: toProfileSummary(profile) });
        my_logger.ConsoleLog(`Profile retrieved successfully. [user_id: ${userId}, profile_id: ${profile._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getProfile', 'Profile retrieved successfully.', { "user_id": userId, "profile_id": profile._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting profile: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getProfile', 'Error getting profile.', { "user_id": userId, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", profiles: [] });
    }
}

/**
 * Update multiple profiles belonging to the authenticated user in a single request.
 * Each entry in req.body.updates must include its own profileId and the fields to change.
 * Ownership is enforced per-entry via the user_id filter, so a profileId that does not
 * belong to the authenticated user is silently skipped rather than updated.
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { updates: [{ profileId: String, profileName?: String, age?: Number, ImageName?: String }] }
//res.json: { success: boolean, message: string, profiles: Array }
const updateAllProfiles = async (req, res) =>
{
    const userId = req.target_user_id;

    // Fetched once up front - reused for every early-return validation failure,
    // since the DB state has not changed yet at those points
    let profiles = await fetchUserProfiles(userId);

    try
    {
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0)
        {
            my_logger.ConsoleLog(`Updates array is required. [user_id: ${userId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('updateAllProfiles', 'Updates array is required.', { "user_id": userId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "Updates array is required", profiles: toProfileSummaryList(profiles) });
        }

        const bulkOperations = [];

        for (const update of updates)
        {
            const { profileId, profileName, age, ImageName } = update;

            if (!profileId || !mongoose.Types.ObjectId.isValid(profileId))
            {
                my_logger.ConsoleLog(`Invalid profileId in updates array. [user_id: ${userId}]`, my_logger.Log_Level.WARNING);
                my_logger.OperationLog('updateAllProfiles', 'Invalid profileId in updates array.', { "user_id": userId, "update": update }, my_logger.Log_Level.WARNING);
                return res.json({ success: false, message: "Each update must include a valid profileId", profiles: toProfileSummaryList(profiles) });
            }

            const fieldsToSet = {};

            if (profileName !== undefined)
            {
                fieldsToSet.profile_name = profileName;
            }

            if (age !== undefined)
            {
                fieldsToSet.age = age;
            }

            if (ImageName !== undefined)
            {
                fieldsToSet.image_name = ImageName;
            }

            if (Object.keys(fieldsToSet).length === 0)
            {
                continue; // Nothing to update for this entry, skip it
            }

            bulkOperations.push({
                updateOne:
                {
                    // user_id in the filter enforces ownership on every single operation
                    filter: { _id: profileId, user_id: userId },
                    update: { $set: fieldsToSet }
                }
            });
        }

        if (bulkOperations.length === 0)
        {
            my_logger.ConsoleLog(`No valid fields to update. [user_id: ${userId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('updateAllProfiles', 'No valid fields to update.', { "user_id": userId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "No valid fields to update", profiles: toProfileSummaryList(profiles) });
        }

        const bulkResult = await Profile.bulkWrite(bulkOperations);

        // Only re-fetch here, because this is the one point where the DB state actually changed
        profiles = await fetchUserProfiles(userId);

        res.json({ success: true, message: "Profiles updated successfully", profiles: toProfileSummaryList(profiles) });
        my_logger.ConsoleLog(`Profiles updated successfully. [user_id: ${userId}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('updateAllProfiles', 'Profiles updated successfully.', { "user_id": userId, "matched_count": bulkResult.matchedCount, "modified_count": bulkResult.modifiedCount }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating profiles: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('updateAllProfiles', 'Error updating profiles.', { "user_id": userId, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", profiles: [] });
    }
}

/**
 * Add or remove a like on a content item for a specific profile (toggle behavior).
 * Likes live on Content only (not per-episode), so this still relies only on
 * authorizeProfileAccess (req.profile) and contentAuthorization (req.content).
 * On success, returns the profile's updated liked content list. On any exception, returns an empty list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, liked: Boolean, likedContentIds: Array }
const pressLike = async (req, res) =>
{
    const userId = req.target_user_id;
    const profile = req.profile;
    const content = req.content;

    try
    {
        const likedIndex = profile.liked_content_ids.findIndex((id) => id.toString() === content._id.toString());

        let isLiked;

        if (likedIndex === -1)
        {
            await Content.updateOne({ _id: content._id }, { $inc: { likes: 1 } });
            profile.liked_content_ids.push(content._id);
            isLiked = true;
        }
        else
        {
            await Content.updateOne({ _id: content._id }, { $inc: { likes: -1 } });
            profile.liked_content_ids.splice(likedIndex, 1);
            isLiked = false;
        }
        await profile.save();

        res.json({
            success: true,
            message: isLiked ? "Media liked" : "Media unliked",
            liked: isLiked,
            likedContentIds: profile.liked_content_ids
        });
        my_logger.ConsoleLog(`Media ${isLiked ? 'liked' : 'unliked'} successfully. [user_id: ${userId}, profile_id: ${profile._id}, content_id: ${content._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('pressLike', `Media ${isLiked ? 'liked' : 'unliked'} successfully.`, { "user_id": userId, "profile_id": profile._id, "content_id": content._id, "liked": isLiked }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error pressing like: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('pressLike', 'Error pressing like.', { "user_id": userId, "profile_id": profile && profile._id, "content_id": content && content._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", likedContentIds: [] });
    }
}

/**
 * Update the last watched episode for a specific profile.
 * If req.episode is not attached (no episodeId route param was given):
 *   - If this content already has an entry in the profile's watch history,
 *     resume from that saved episode (last_watched entries are unique per
 *     content, since each watch replaces the previous entry for the same content).
 *   - Otherwise, default to season 1, episode 1 of req.content - "watching a
 *     show" for the first time with no episode specified starts from the beginning.
 * Relies on authorizeProfileAccess (req.profile) and contentAuthorization (req.content,
 * and req.episode when an episodeId route param is present).
 * Moves the entry to the front of the history and trims it to MAX_LAST_WATCHED_CONTENT_LIMIT.
 * Returns a lightweight summary of the episode that was recorded as watched.
 * On success, returns the profile's updated watch history list. On any exception, returns an empty list.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, episode: Object, lastWatched: Array }
const watchMedia = async (req, res) =>
{
    const userId = req.target_user_id;
    const profile = req.profile;
    const content = req.content;
    let episode = req.episode;

    try
    {
        if (!episode)
        {
            // No specific episode requested - resume from the saved episode for
            // this content if one exists in the history, otherwise start at S1E1
            const savedEntry = profile.last_watched.find(
                (entry) => entry.content_id.toString() === content._id.toString()
            );

            if (savedEntry)
            {
                episode = await Episode.findById(savedEntry.episode_id);
            }

            if (!episode)
            {
                episode = await Episode.findOne({ content_id: content._id, season_number: 1, episode_number: 1 });
            }

            if (!episode)
            {
                return res.json({ success: false, message: "This content has no episodes yet", lastWatched: toLastWatchedSummary(profile.last_watched) });
            }
        }

        // Remove the content's previous entry from the history, to avoid duplicates
        // (one entry per content, regardless of which episode was previously saved)
        profile.last_watched = profile.last_watched.filter(
            (entry) => entry.content_id.toString() !== content._id.toString()
        );

        // Add it to the front, as the most recently watched
        profile.last_watched.unshift({ episode_id: episode._id, content_id: content._id });

        // Trim the history to the maximum allowed length
        if (profile.last_watched.length > MAX_LAST_WATCHED_CONTENT_LIMIT)
        {
            profile.last_watched = profile.last_watched.slice(0, MAX_LAST_WATCHED_CONTENT_LIMIT);
        }

        await profile.save();

        res.json({
            success: true,
            message: "Watch progress updated",
            episode: toEpisodeSummary(episode),
            lastWatched: toLastWatchedSummary(profile.last_watched)
        });
        my_logger.ConsoleLog(`Watch progress updated successfully. [user_id: ${userId}, profile_id: ${profile._id}, content_id: ${content._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('watchMedia', 'Watch progress updated successfully.', { "user_id": userId, "profile_id": profile._id, "content_id": content._id, "episode_id": episode._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating watch progress: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('watchMedia', 'Error updating watch progress.', { "user_id": userId, "profile_id": profile && profile._id, "content_id": content && content._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", lastWatched: [] });
    }
}

/**
 * Getter - returns the full profile document (all fields), unlike other endpoints
 * which return the lightweight summary via toProfileSummary.
 * Relies on authorizeProfileAccess having already verified ownership (req.profile).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, profile: Object }
const getProfileDetails = async (req, res) =>
{
    const userId = req.target_user_id;
    const profile = req.profile;

    try
    {
        //need to return the full profile but as profile summary style plus likes content ids and last watched history.
        //but as one profile field in response.
        const responseProfile = 
        {
            ...(toProfileSummary(profile)),
            likedContentIds: profile.liked_content_ids,
            lastWatched: toLastWatchedSummary(profile.last_watched)
        };
        res.json({ success: true, profile: responseProfile });
        my_logger.ConsoleLog(`Profile details retrieved successfully. [user_id: ${userId}, profile_id: ${profile._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getProfileDetails', 'Profile details retrieved successfully.', { "user_id": userId, "profile_id": profile._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting profile details: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getProfileDetails', 'Error getting profile details.', { "user_id": userId, "profile_id": profile && profile._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}
 
/**
 * Given a profile ID, finds and returns the User document that owns it (admin only).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.params: { profileId: string }
//res.json: { success: boolean, message: string, user?: Object }
const findUserByProfileId = async (req, res) =>
{
    try
    {
        const { profileId } = req.params;
        if (!profileId)
        {
            return res.json({ success: false, message: 'Profile ID is missing' });
        }
        const profile = await Profile.findById(profileId);
        if (!profile)
        {
            return res.json({ success: false, message: 'Profile not found' });
        }
 
        // ASSUMPTION - see file header: adjust `profile.user_id` if your schema names the
        // owning-user reference field differently.
        const user = await User.findById(profile.user_id);
        if (!user)
        {
            return res.json({ success: false, message: 'Owning user not found (dangling profile reference)' });
        }
 
        const userSummary = safe_user(user);
 
        res.json({ success: true, message: 'User found successfully', user: userSummary });
        my_logger.ConsoleLog(`User found by profile id successfully. [profile_id: ${profileId}, user_id: ${user._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('findUserByProfileId', 'User found by profile id.', { "admin_user_id": req.admin_user_id, "profile_id": profileId, "user_id": user._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error finding user by profile id: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('findUserByProfileId', 'Error finding user by profile id.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}
 

module.exports =
{
    createProfile,
    deleteProfile,
    updateProfile,
    getProfile,
    updateAllProfiles,
    pressLike,
    watchMedia,
    getProfileDetails,
    findUserByProfileId
};