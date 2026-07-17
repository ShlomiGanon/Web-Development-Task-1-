const mongoose = require('mongoose');
const my_logger = require('../scripts/my_logger');
const Review = require('../models/review');
const Profile = require('../models/profile');
const User = require('../models/user');
/**
 * Helper to convert a full Review document into a lightweight object
 * containing only the fields exposed to the client.
 */

const toReviewSummary = (review, reviewerName = "NONE") =>
    {
        return {
            id: review._id,
            contentId: review.content_id,
            episodeId: review.episode_id,
            profileId: review.profile_id,
            reviewerName: reviewerName,
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
 * Update the authenticated profile's own review for a specific episode (rating and/or comment).
 * Identifies the review via (episode_id, profile_id) rather than a reviewId, since a profile
 * can only ever have one review per episode.
 * Relies on authorizeProfileAccess (req.profile) and contentAuthorization
 * (req.episode - the route must carry both contentId and episodeId).
 * Recalculates the content's average_rating and review_count after a rating change.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { rating?: Number, comment?: String }
//res.json: { success: boolean, message: string, review?: Object }
const updateReview = async (req, res) =>
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

        const review = await Review.findOne({ episode_id: episode._id, profile_id: profile._id });

        if (!review)
        {
            return res.json({ success: false, message: "You have not reviewed this episode yet" });
        }

        const { rating, comment } = req.body;

        if (rating === undefined && comment === undefined)
        {
            return res.json({ success: false, message: "Nothing to update" });
        }

        if (rating !== undefined)
        {
            const numericRating = Number(rating);

            if (Number.isNaN(numericRating))
            {
                return res.json({ success: false, message: "A valid numeric rating is required" });
            }

            review.rating = numericRating;
        }

        if (comment !== undefined)
        {
            review.comment = comment;
        }

        try
        {
            await review.save();
        }
        catch (dbError)
        {
            if (dbError.name === 'ValidationError')
            {
                return res.json({ success: false, message: "Rating must be between 1 and 10" });
            }

            throw dbError;
        }

        // Rating may have changed - recalculate the content's average_rating/review_count
        await Review.updateContentAverageRating(review.content_id);

        res.json({ success: true, message: "Review updated successfully", review: toReviewSummary(review) });
        my_logger.ConsoleLog(`Review updated successfully. [profile_id: ${profile._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('updateReview', 'Review updated successfully.', { "user_id": userId, "profile_id": profile._id, "review": toReviewSummary(review) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating review: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('updateReview', 'Error updating review.', { "user_id": userId, "profile_id": profile && profile._id, "episode_id": episode && episode._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Remove the authenticated profile's own review for a specific episode.
 * Identifies the review via (episode_id, profile_id) rather than a reviewId,
 * since the schema guarantees at most one review per profile per episode.
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

/**
 * Update any review by its ID (admin only) - e.g. to remove inappropriate content
 * from a comment, or correct a rating. Not scoped to any profile/content/episode -
 * the reviewId alone is enough. Recalculates the content's average_rating and
 * review_count after a rating change.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.params: { reviewId: String }
//req.body: { rating?: Number, comment?: String }
//res.json: { success: boolean, message: string, review?: Object }
const adminUpdateReview = async (req, res) =>
{
    const adminUserId = req.admin_user_id;
    const reviewId = req.params.reviewId;

    try
    {
        if (!mongoose.Types.ObjectId.isValid(reviewId))
        {
            return res.json({ success: false, message: "Invalid review ID format" });
        }

        const review = await Review.findById(reviewId);

        if (!review)
        {
            return res.json({ success: false, message: "Review not found" });
        }

        const { rating, comment } = req.body;

        if (rating === undefined && comment === undefined)
        {
            return res.json({ success: false, message: "Nothing to update" });
        }

        const old_data = toReviewSummary(review);

        if (rating !== undefined)
        {
            const numericRating = Number(rating);

            if (Number.isNaN(numericRating))
            {
                return res.json({ success: false, message: "A valid numeric rating is required" });
            }

            review.rating = numericRating;
        }

        if (comment !== undefined)
        {
            review.comment = comment;
        }

        try
        {
            await review.save();
        }
        catch (dbError)
        {
            if (dbError.name === 'ValidationError')
            {
                return res.json({ success: false, message: "Rating must be between 1 and 10" });
            }

            throw dbError;
        }

        await Review.updateContentAverageRating(review.content_id);

        res.json({ success: true, message: "Review updated successfully", review: toReviewSummary(review) });
        my_logger.ConsoleLog(`Review updated successfully by admin. [review_id: ${review._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('adminUpdateReview', 'Review updated successfully by admin.', { "admin_user_id": adminUserId, "old_data": old_data, "new_data": toReviewSummary(review) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating review (admin): ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('adminUpdateReview', 'Error updating review.', { "admin_user_id": adminUserId, "review_id": reviewId, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Delete any review by its ID (admin only). Recalculates the content's
 * average_rating and review_count afterward (handled inside Review.removeReview).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.params: { reviewId: String }
//res.json: { success: boolean, message: string }
const adminRemoveReview = async (req, res) =>
{
    const adminUserId = req.admin_user_id;
    const reviewId = req.params.reviewId;

    try
    {
        if (!mongoose.Types.ObjectId.isValid(reviewId))
        {
            return res.json({ success: false, message: "Invalid review ID format" });
        }

        const review = await Review.removeReview(reviewId);

        if (!review)
        {
            return res.json({ success: false, message: "Review not found" });
        }

        res.json({ success: true, message: "Review deleted successfully" });
        my_logger.ConsoleLog(`Review deleted successfully by admin. [review_id: ${reviewId}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('adminRemoveReview', 'Review deleted successfully by admin.', { "admin_user_id": adminUserId, "deleted_review": toReviewSummary(review) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error deleting review (admin): ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('adminRemoveReview', 'Error deleting review.', { "admin_user_id": adminUserId, "review_id": reviewId, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Search / list reviews using query filters (public).
 * Uses the same buildQuery pattern as User.buildQuery/Content.buildQuery - see
 * models/review.js searchFilterMap for the full list of supported query params
 * (content_id, episode_id, profile_id, user_id, rating, min_rating, max_rating,
 * comment_starts/ends/contains).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.query: { ...searchFilterMap keys, limit?, skip?, sort?, sortOrder? }
//res.json: { success: boolean, message: string, reviews: Array }
const searchReviews = async (req, res) =>
{
    try
    {
        const query = Review.buildQuery(req.query);
        const limit = req.query.limit || 20;
        const skip = req.query.skip || 0;
        const sort = req.query.sort || 'createdAt';
        let sortOrder = 'desc';

        if (req.query.sortOrder == 'greater_to_smaller')
        {
            sortOrder = 'desc';
        }
        else if (req.query.sortOrder == 'smaller_to_greater')
        {
            sortOrder = 'asc';
        }
        else if (req.query.sortOrder)
        {
            return res.json({ success: false, message: 'Invalid sort order! [use greater_to_smaller or smaller_to_greater]' });
        }

        const reviews = await Review.find(query).limit(limit).skip(skip).sort({ [sort]: sortOrder });
 
        // Fetch profile names for these reviews in one batch query.
        const profileIds = [...new Set(reviews.map(review => review.profile_id.toString()))];
        const profiles = await Profile.find({ _id: { $in: profileIds } }, 'profile_name');
        const profileInfoById = new Map(profiles.map(profile => [profile._id.toString(), { profileName: profile.profile_name }]));
        const userIds = [...new Set(reviews.map(review => review.user_id.toString()))];
        const users = await User.find({ _id: { $in: userIds } }, 'full_name');
        const userInfoById = new Map(users.map(user => [user._id.toString(), { fullName: user.full_name }]));

        res.json({ success: true, message: 'Reviews searched successfully', reviews: reviews.map(review => toReviewSummary(review, `${userInfoById.get(review.user_id.toString())?.fullName ?? ""} - (${profileInfoById.get(review.profile_id.toString())?.profileName ?? ""})`)) });   }
    catch (error)
    {
        my_logger.ConsoleLog(`Error searching reviews: ${error}`, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

module.exports = { addReview, updateReview, removeReview, adminUpdateReview, adminRemoveReview, searchReviews, toReviewSummary };