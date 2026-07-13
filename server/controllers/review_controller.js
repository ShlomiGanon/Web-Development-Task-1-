const my_logger = require('../scripts/my_logger');
const Review = require('../models/review');

/**
 * Helper to convert a full Review document into a lightweight object
 * containing only the fields exposed to the client.
 */
const toReviewSummary = (review) =>
{
    return {
        id: review._id,
        contentId: review.content_id,
        episodeId: review.episode_id,
        profileId: review.profile_id,
        rating: review.rating,
        comment: review.comment
    };
}

/**
 * Add a review (rating + optional comment) for a specific episode, written by
 * the authenticated profile. A profile can only review a given episode once -
 * a second attempt is rejected with a clear message (enforced by the schema's
 * unique episode_id+profile_id index).
 * Relies on authorizeProfileAccess (req.profile) and contentAuthorization
 * (req.content and req.episode - the route must carry both contentId and episodeId).
 * Creating the review automatically recalculates the content's average_rating
 * and review_count (handled inside Review.addReview).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { rating: Number, comment?: String }
//res.json: { success: boolean, message: string, review?: Object }
const addReview = async (req, res) =>
{
    const userId = req.target_user_id;
    const profile = req.profile;
    const content = req.content;
    const episode = req.episode;

    try
    {
        if (!episode)
        {
            return res.json({ success: false, message: "Episode ID is required" });
        }

        const comment = req.body.comment;
        const rating = req.body.rating !== undefined ? Number(req.body.rating) : undefined;

        if (rating === undefined || Number.isNaN(rating))
        {
            return res.json({ success: false, message: "A valid numeric rating is required" });
        }

        let review;

        try
        {
            review = await Review.addReview({
                content_id: content._id,
                episode_id: episode._id,
                profile_id: profile._id,
                user_id: userId,
                rating,
                comment
            });
        }
        catch (dbError)
        {
            if (dbError.code === 11000)
            {
                return res.json({ success: false, message: "You have already reviewed this episode" });
            }

            if (dbError.name === 'ValidationError')
            {
                return res.json({ success: false, message: "Rating must be between 1 and 10" });
            }

            throw dbError;
        }

        res.json({ success: true, message: "Review added successfully", review: toReviewSummary(review) });
        my_logger.ConsoleLog(`Review added successfully. [profile_id: ${profile._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('addReview', 'Review added successfully.', { "user_id": userId, "profile_id": profile._id, "review": toReviewSummary(review) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error adding review: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('addReview', 'Error adding review.', { "user_id": userId, "profile_id": profile && profile._id, "content_id": content && content._id, "episode_id": episode && episode._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Remove the authenticated profile's own review for a specific episode.
 * Identifies the review via (episode_id, profile_id) rather than a reviewId,
 * since the schema guarantees at most one review per profile per episode -
 * the same profile can only ever have one review to delete for a given episode.
 * Relies on authorizeProfileAccess (req.profile) and contentAuthorization
 * (req.episode - the route must carry both contentId and episodeId).
 * Removing the review automatically recalculates the content's average_rating
 * and review_count (handled inside Review.removeReview).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string }
const removeReview = async (req, res) =>
{
    const userId = req.target_user_id;
    const profile = req.profile;
    const episode = req.episode;

    try
    {
        if (!episode)
        {
            return res.json({ success: false, message: "Episode ID is required" });
        }

        const existingReview = await Review.findOne({ episode_id: episode._id, profile_id: profile._id });

        if (!existingReview)
        {
            return res.json({ success: false, message: "You have not reviewed this episode" });
        }

        await Review.removeReview(existingReview._id);

        res.json({ success: true, message: "Review removed successfully" });
        my_logger.ConsoleLog(`Review removed successfully. [profile_id: ${profile._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('removeReview', 'Review removed successfully.', { "user_id": userId, "profile_id": profile._id, "episode_id": episode._id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error removing review: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('removeReview', 'Error removing review.', { "user_id": userId, "profile_id": profile && profile._id, "episode_id": episode && episode._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

module.exports = { addReview, removeReview, toReviewSummary };