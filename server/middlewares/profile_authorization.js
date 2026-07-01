const mongoose = require('mongoose');
const Profile = require('../models/profile'); // Adjust path to match your actual model location

/**
 * Middleware to verify that the requested profile exists and belongs to the authenticated user.
 * Must run after tokenVerification (relies on req.user_id).
 * The profileId is expected as a route parameter.
 * Attaches the found profile to req.profile for use in the controller.
 */
const authorizeProfileAccess = async (req, res, next) =>
{
    try
    {
        const userId = req.user_id;
        const profileId = req.params.profileId;

        if (!userId)
        {
            return res.json({ success: false, message: "Unauthorized" });
        }

        if (!profileId)
        {
            return res.json({ success: false, message: "Profile ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(profileId))
        {
            return res.json({ success: false, message: "Invalid profile ID format" });
        }

        const profile = await Profile.findOne({ _id: profileId });

        if (!profile || profile.User_ID.toString() !== userId.toString())
        {
            return res.json({ success: false, message: "Profile not found or access denied" });
        }

        req.profile = profile;

        next();
    }
    catch (error)
    {
        console.error('Error in authorizeProfileAccess:', error);
        return res.json({ success: false, message: "Internal server error" });
    }
}

module.exports = { authorizeProfileAccess };