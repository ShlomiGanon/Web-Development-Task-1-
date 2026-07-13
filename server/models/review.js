const mongoose = require("mongoose");

/**
 * Review Schema
 * Represents a single profile's review of a specific episode.
 */
const reviewSchema = new mongoose.Schema(
{
    // Reference to the parent Content document
    content_id: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Content", 
        required: true, 
        index: true 
    },

    // Reference to the specific episode being reviewed
    episode_id: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Episode", 
        required: true, 
        index: true 
    },

    // Reference to the profile that wrote the review
    profile_id: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Profile",
        required: true,
        index: true
    },

    // Reference to the account that owns the profile
    user_id: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true, 
        index: true 
    },

    // Rating on a scale of 1 to 10
    rating: 
    { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 10 
    },

    // Free-text comment
    comment: 
    { 
        type: String, 
        trim: true, 
        maxlength: 500 
    }
},
{
    timestamps: true
});

// Compound unique index on episode_id + profile_id
reviewSchema.index({ episode_id: 1, profile_id: 1 }, { unique: true });

// --- Search / filtering support ---

// Escapes regex special characters in a value
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Builds the regex pattern string for each string operator
const regexPatternBuilders = 
{
    regex_start:    (value) => `^${escapeRegex(value)}`,
    regex_end:      (value) => `${escapeRegex(value)}$`,
    regex_contains: (value) => `${escapeRegex(value)}`,
};

/**
 * Maps a query key to its target dbField, operator, and value type.
 */
reviewSchema.statics.searchFilterMap = 
{
    'content_id': { dbField: 'content_id', operator: '$eq', type: 'exact' },
    'episode_id': { dbField: 'episode_id', operator: '$eq', type: 'exact' },
    'profile_id': { dbField: 'profile_id', operator: '$eq', type: 'exact' },
    'user_id':    { dbField: 'user_id',    operator: '$eq', type: 'exact' },

    'rating':     { dbField: 'rating', operator: '$eq',  type: 'number' },
    'min_rating': { dbField: 'rating', operator: '$gte', type: 'number' },
    'max_rating': { dbField: 'rating', operator: '$lte', type: 'number' },

    'comment_starts':   { dbField: 'comment', operator: 'regex_start',    type: 'string' },
    'comment_ends':     { dbField: 'comment', operator: 'regex_end',      type: 'string' },
    'comment_contains': { dbField: 'comment', operator: 'regex_contains', type: 'string' },
};

/**
 * Builds a MongoDB filter object from raw query params using searchFilterMap.
 * Unrecognized keys are ignored. Filters on the same dbField are merged.
 */
reviewSchema.statics.buildQuery = function(rawQuery)
{
    const dbFilter = {};
    const map = this.searchFilterMap;

    for (const [key, value] of Object.entries(rawQuery))
    {
        if (!map[key] || value === undefined || value === null || value === "") continue;

        const { dbField, operator, type } = map[key];

        if (type === 'number')
        {
            if (!dbFilter[dbField]) dbFilter[dbField] = {};

            if (operator === '$eq')
            {
                dbFilter[dbField] = Number(value);
            }
            else
            {
                if (typeof dbFilter[dbField] !== 'object')
                {
                    dbFilter[dbField] = { $eq: dbFilter[dbField] };
                }
                dbFilter[dbField][operator] = Number(value);
            }
        }
        else if (type === 'exact')
        {
            dbFilter[dbField] = value;
        }
        else if (type === 'string')
        {
            dbFilter[dbField] = { $regex: regexPatternBuilders[operator](value), $options: 'i' };
        }
    }

    return dbFilter;
};

/**
 * Computes the average rating and review count for a given episode_id
 * or content_id (exactly one of the two should be provided).
 */
reviewSchema.statics.getAverageRating = async function({ episodeId, contentId } = {})
{
    const match = {};

    if (episodeId) match.episode_id = new mongoose.Types.ObjectId(episodeId);
    if (contentId) match.content_id = new mongoose.Types.ObjectId(contentId);

    const result = await this.aggregate([
        { $match: match },
        {
            $group:
            {
                _id: null,
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    if (result.length === 0)
    {
        return { averageRating: 0, totalReviews: 0 };
    }

    return {
        averageRating: result[0].averageRating,
        totalReviews: result[0].totalReviews
    };
};

/**
 * Recomputes the average rating for a content_id and writes it onto
 * the corresponding Content document's average_rating/review_count fields.
 */
reviewSchema.statics.updateContentAverageRating = async function(contentId)
{
    const { averageRating, totalReviews } = await this.getAverageRating({ contentId });

    await mongoose.model("Content").findByIdAndUpdate(contentId,
    {
        average_rating: averageRating,
        review_count: totalReviews
    });
};

/**
 * Creates a new review and recomputes Content's average_rating/review_count.
 */
reviewSchema.statics.addReview = async function(reviewData)
{
    const review = await this.create(reviewData);

    await this.updateContentAverageRating(review.content_id);

    return review;
};

/**
 * Deletes a review by id and recomputes Content's average_rating/review_count.
 */
reviewSchema.statics.removeReview = async function(reviewId)
{
    const review = await this.findByIdAndDelete(reviewId);

    if (review)
    {
        await this.updateContentAverageRating(review.content_id);
    }

    return review;
};

module.exports = mongoose.model("Review", reviewSchema);