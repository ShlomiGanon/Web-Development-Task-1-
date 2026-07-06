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
const contentAuthorization = async (req, res, next) =>
{
    try
    {
        const contentId = req.params.contentId;

        if (!contentId)
        {
            return res.json({ success: false, message: "Content ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(contentId))
        {
            return res.json({ success: false, message: "Invalid content ID format" });
        }

        const content = await Content.findOne({ _id: contentId });

        if (!content)
        {
            return res.json({ success: false, message: "Content not found" });
        }

        // If a profile was already resolved earlier in the chain, enforce the age limit
        if (ENABLE_AGE_LIMIT_CHECK && req.profile && req.profile.age < content.age_limit)
        {
            return res.json({ success: false, message: "This content is not allowed for this profile" });
        }

        req.content = content;
        next();
    }
    catch (error)
    {
        console.error('Error in mediaAuthorization: ', error);
        return res.json({ success: false, message: "Internal server error" });
    }
}

module.exports = { contentAuthorization };