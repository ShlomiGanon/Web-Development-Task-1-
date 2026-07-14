const mongoose = require('mongoose');
const Content = require('../models/content');
const Episode = require('../models/episode');
const { ENABLE_18_AGE_LIMIT_CHECK } = require('../scripts/constants');

/**
 * Middleware to verify that the requested media exists and, if a profile
 * is attached to the request (via authorizeProfileAccess), that the
 * profile's age meets the media's age limit.
 * The contentId is expected as a route parameter, attaches the found content to req.content.
 * If episodeId is also present as a route parameter, verifies it belongs to
 * this content and attaches it to req.episode.
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

        const content = await Content.findById(contentId);

        if (!content)
        {
            return res.json({ success: false, message: "Content not found" });
        }

        // If a profile was already resolved earlier in the chain, enforce the age limit
        if (ENABLE_18_AGE_LIMIT_CHECK && req.profile && req.profile.age < content.age_limit)
        {
            return res.json({ success: false, message: "This content is not allowed for this profile" });
        }

        req.content = content;

        // If the route also carries an episodeId, resolve and attach it too,
        // since content and episode are always validated together
        const episodeId = req.params.episodeId;

        if (episodeId)
        {
            if (!mongoose.Types.ObjectId.isValid(episodeId))
            {
                return res.json({ success: false, message: "Invalid episode ID format" });
            }

            const episode = await Episode.findOne({ _id: episodeId, content_id: content._id });

            if (!episode)
            {
                return res.json({ success: false, message: "Episode not found for this content" });
            }

            req.episode = episode;
        }

        next();
    }
    catch (error)
    {
        console.error('Error in mediaAuthorization: ', error);
        return res.json({ success: false, message: "Internal server error" });
    }
}

module.exports = { contentAuthorization };