const mongoose = require('mongoose');
const Profile = require('../models/profile');
const User = require('../models/user');
const { MAX_LAST_WATCHED_MEDIA_LIMIT } = require('../scripts/constants');
const my_logger = require('../scripts/my_logger');

/**
 * Helper to fetch the current list of profiles belonging to a user.
 */
const fetchUserProfiles = async (userId) =>
{
    return await Profile.find({ User_ID: userId });
}

/**
 * Helper to convert a full Profile document into a lightweight object
 * containing only the fields exposed to the client.
 */
const toProfileSummary = (profile) =>
{
    return {
        id: profile._id,
        profileName: profile.profileName,
        age: profile.age,
        ImageName: profile.ImageName
    };
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
 * Delegates to User.addProfile to enforce MAX_PROFILES_LIMIT and keep profileIds in sync.
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 */
const createProfile = async (req, res) =>
{
    const userId = req.user_id;

    try
    {
        const user = await User.findById(userId);

        if (!user)
        {
            my_logger.ConsoleLog(`Failed to create profile, user not found. [user_id: ${userId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('createProfile', 'User not found.', { "user_id": userId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "User not found", profiles: [] });
        }

        const newProfile = await user.addProfile();

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
 * Delegates to User.removeProfile to keep profileIds in sync and enforce the
 * "at least one profile" rule. Relies on authorizeProfileAccess for ownership (req.profile).
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 */
const deleteProfile = async (req, res) =>
{
    const userId = req.user_id;
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

        await user.removeProfile(profileId);

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
 */
const updateProfile = async (req, res) =>
{
    const userId = req.user_id;
    const profile = req.profile;

    try
    {
        const { profileName, age, ImageName } = req.body;
        const old_data = { profileName: profile.profileName, age: profile.age, ImageName: profile.ImageName };
        const changes = {};

        if (profileName !== undefined)
        {
            profile.profileName = profileName;
            changes.profileName = profileName;
        }

        if (age !== undefined)
        {
            profile.age = age;
            changes.age = age;
        }

        if (ImageName !== undefined)
        {
            profile.ImageName = ImageName;
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
 * This route does not use authorizeProfileAccess, so ownership is checked manually here.
 * Always returns lightweight profile summaries, not full documents - use getProfileDetails for the full document.
 * On any exception, returns an empty profiles list.
 */
const getProfile = async (req, res) =>
{
    const userId = req.user_id;

    try
    {
        const profileId = req.params.profileId;

        if (!profileId)
        {
            const profiles = await fetchUserProfiles(userId);
            res.json({ success: true, message: "Profiles retrieved successfully", profiles: toProfileSummaryList(profiles) });
            my_logger.ConsoleLog(`Profiles retrieved successfully. [user_id: ${userId}]`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('getProfile', 'Profiles retrieved successfully.', { "user_id": userId, "count": profiles.length }, my_logger.Log_Level.INFO);
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(profileId))
        {
            my_logger.ConsoleLog(`Invalid profile ID format. [user_id: ${userId}, profile_id: ${profileId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('getProfile', 'Invalid profile ID format.', { "user_id": userId, "profile_id": profileId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "Invalid profile ID format" });
        }

        const profile = await Profile.findOne({ _id: profileId });

        // Same generic message for "not found" and "not owned" to avoid leaking existence of the ID
        if (!profile || profile.User_ID.toString() !== userId.toString())
        {
            my_logger.ConsoleLog(`Profile not found or access denied. [user_id: ${userId}, profile_id: ${profileId}]`, my_logger.Log_Level.WARNING);
            my_logger.OperationLog('getProfile', 'Profile not found or access denied.', { "user_id": userId, "profile_id": profileId }, my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: "Profile not found or access denied" });
        }

        res.json({ success: true, message: "Profile retrieved successfully", profile: toProfileSummary(profile) });
        my_logger.ConsoleLog(`Profile retrieved successfully. [user_id: ${userId}, profile_id: ${profileId}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getProfile', 'Profile retrieved successfully.', { "user_id": userId, "profile_id": profileId }, my_logger.Log_Level.INFO);
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
 * Ownership is enforced per-entry via the User_ID filter, so a profileId that does not
 * belong to the authenticated user is silently skipped rather than updated.
 * On success, returns the current profiles summary list. On any exception, returns an empty list.
 */
const updateAllProfiles = async (req, res) =>
{
    const userId = req.user_id;

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
                fieldsToSet.profileName = profileName;
            }

            if (age !== undefined)
            {
                fieldsToSet.age = age;
            }

            if (ImageName !== undefined)
            {
                fieldsToSet.ImageName = ImageName;
            }

            if (Object.keys(fieldsToSet).length === 0)
            {
                continue; // Nothing to update for this entry, skip it
            }

            bulkOperations.push({
                updateOne:
                {
                    // User_ID in the filter enforces ownership on every single operation
                    filter: { _id: profileId, User_ID: userId },
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
 * Add or remove a like on a media item for a specific profile (toggle behavior).
 * Relies on authorizeProfileAccess (req.profile) and mediaAuthorization (req.media).
 * On success, returns the profile's updated liked media list. On any exception, returns an empty list.
 */
const pressLike = async (req, res) =>
{
    const userId = req.user_id;
    const profile = req.profile;
    const media = req.media;

    try
    {
        const likedIndex = profile.Liked_Media_IDs.findIndex((id) => id.toString() === media._id.toString());

        let isLiked;

        if (likedIndex === -1)
        {
            profile.Liked_Media_IDs.push(media._id);
            isLiked = true;
        }
        else
        {
            profile.Liked_Media_IDs.splice(likedIndex, 1);
            isLiked = false;
        }

        await profile.save();

        res.json({
            success: true,
            message: isLiked ? "Media liked" : "Media unliked",
            liked: isLiked,
            likedMediaIds: profile.Liked_Media_IDs
        });
        my_logger.ConsoleLog(`Media ${isLiked ? 'liked' : 'unliked'} successfully. [user_id: ${userId}, profile_id: ${profile._id}, media_id: ${media._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('pressLike', `Media ${isLiked ? 'liked' : 'unliked'} successfully.`, { "user_id": userId, "profile_id": profile._id, "media_id": media._id, "liked": isLiked }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error pressing like: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('pressLike', 'Error pressing like.', { "user_id": userId, "profile_id": profile._id, "media_id": media._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", likedMediaIds: [] });
    }
}

/**
 * Update the last watched media for a specific profile.
 * Moves the media to the front of the history and trims it to MAX_LAST_WATCHED_MEDIA_LIMIT.
 * Relies on authorizeProfileAccess (req.profile) and mediaAuthorization (req.media).
 * On success, returns the profile's updated watch history list. On any exception, returns an empty list.
 */
const watchMedia = async (req, res) =>
{
    const userId = req.user_id;
    const profile = req.profile;
    const media = req.media;

    try
    {
        // Remove the media if it already exists in the history, to avoid duplicates
        profile.LastWatched_Media_IDs = profile.LastWatched_Media_IDs.filter(
            (id) => id.toString() !== media._id.toString()
        );

        // Add it to the front, as the most recently watched
        profile.LastWatched_Media_IDs.unshift(media._id);

        // Trim the history to the maximum allowed length
        if (profile.LastWatched_Media_IDs.length > MAX_LAST_WATCHED_MEDIA_LIMIT)
        {
            profile.LastWatched_Media_IDs = profile.LastWatched_Media_IDs.slice(0, MAX_LAST_WATCHED_MEDIA_LIMIT);
        }

        await profile.save();

        //TO-DO: add the media video data to the response
        res.json({
            success: true,
            message: "Watch progress updated",
            watchHistory: profile.LastWatched_Media_IDs
        });
        my_logger.ConsoleLog(`Watch progress updated successfully. [user_id: ${userId}, profile_id: ${profile._id}, media_id: ${media._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('watchMedia', 'Watch progress updated successfully.', { "user_id": userId, "profile_id": profile._id, "media_id": media._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating watch progress: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('watchMedia', 'Error updating watch progress.', { "user_id": userId, "profile_id": profile._id, "media_id": media._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error", watchHistory: [] });
    }
}

/**
 * Getter - returns the full profile document (all fields), unlike other endpoints
 * which return the lightweight summary via toProfileSummary.
 * Relies on authorizeProfileAccess having already verified ownership (req.profile).
 */
const getProfileDetails = async (req, res) =>
{
    const userId = req.user_id;
    const profile = req.profile;

    try
    {
        res.json({ success: true, profile: profile });
        my_logger.ConsoleLog(`Profile details retrieved successfully. [user_id: ${userId}, profile_id: ${profile._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getProfileDetails', 'Profile details retrieved successfully.', { "user_id": userId, "profile_id": profile._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting profile details: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getProfileDetails', 'Error getting profile details.', { "user_id": userId, "profile_id": profile._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
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
    getProfileDetails
};