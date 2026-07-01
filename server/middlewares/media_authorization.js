const mongoose = require('mongoose');
const Content = require('../models/content'); // Adjust path to match your actual model location
const ENABLE_AGE_LIMIT_CHECK = true;
/**
 * Middleware to verify that the requested media exists and, if a profile
 * is attached to the request (via authorizeProfileAccess), that the
 * profile's age meets the media's age limit.
 * The mediaId is expected as a route parameter.
 * Attaches the found media to req.media for use in the controller.
 */
const mediaAuthorization = async (req, res, next) =>
{
    try
    {
        const mediaId = req.params.mediaId;

        if (!mediaId)
        {
            return res.json({ success: false, message: "Media ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(mediaId))
        {
            return res.json({ success: false, message: "Invalid media ID format" });
        }

        const media = await Content.findOne({ _id: mediaId });

        if (!media)
        {
            return res.json({ success: false, message: "Media not found" });
        }

        // If a profile was already resolved earlier in the chain, enforce the age limit
        if (ENABLE_AGE_LIMIT_CHECK && req.profile && req.profile.age < media.age_limit)
        {
            return res.json({ success: false, message: "This content is not allowed for this profile" });
        }

        req.media = media;
        next();
    }
    catch (error)
    {
        console.error('Error in mediaAuthorization: ', error);
        return res.json({ success: false, message: "Internal server error" });
    }
}

module.exports = { mediaAuthorization };