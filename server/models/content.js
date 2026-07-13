const mongoose = require("mongoose");

/**
 * Content Schema
 * Represents a top-level piece of content on the platform (a movie or a series).
 */
const contentSchema = new mongoose.Schema(
{
    // Title of the movie or series
    title: 
    { 
        type: String, 
        required: true, 
        trim: true 
    },

    // Synopsis / description text
    description: 
    { 
        type: String, 
        default: "" 
    },

    // Filename of the cover/poster image
    cover_image_name: 
    { 
        type: String, 
        default: "UNDEFINED_COVER.png" 
    },

    // Movie or series
    type: 
    { 
        type: String, 
        required: true, 
        enum: ["movie", "series"] 
    },

    // Genre/category tags
    categories: 
    { 
        type: [String], 
        default: [] 
    },

    // Release date
    release_date: 
    { 
        type: Date, 
        required: true 
    },

    // Minimum recommended viewer age
    age_limit: 
    { 
        type: Number, 
        default: 0 
    },

    // Number of likes
    likes: 
    { 
        type: Number, 
        default: 0 
    },

    // Average rating across all reviews, kept in sync by Review's post-save/delete hooks
    average_rating: 
    { 
        type: Number, 
        default: 0 
    },

    // Total number of reviews, kept in sync by Review's post-save/delete hooks
    review_count: 
    { 
        type: Number, 
        default: 0 
    }
},
{
    timestamps: true
});

// Index on type
contentSchema.index({ type: 1 });

// Index on categories
contentSchema.index({ categories: 1 });

// Index on release_date
contentSchema.index({ release_date: 1 });

// Index on age_limit
contentSchema.index({ age_limit: 1 });

// Index on likes, descending
contentSchema.index({ likes: -1 });

// Index on average_rating, descending
contentSchema.index({ average_rating: -1 });

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
contentSchema.statics.searchFilterMap = 
{
    'title_starts':    { dbField: 'title', operator: 'regex_start',    type: 'string' },
    'title_ends':      { dbField: 'title', operator: 'regex_end',      type: 'string' },
    'title_contains':  { dbField: 'title', operator: 'regex_contains', type: 'string' },

    'exact_category':   { dbField: 'categories', operator: '$all', type: 'array' },
    'contain_category': { dbField: 'categories', operator: '$in',  type: 'array' },
    'exclude_category': { dbField: 'categories', operator: '$nin', type: 'array' },

    'type': { dbField: 'type', operator: '$eq', type: 'exact' },

    'released_after':  { dbField: 'release_date', operator: '$gte', type: 'date' },
    'released_before': { dbField: 'release_date', operator: '$lte', type: 'date' },

    'max_age_limit': { dbField: 'age_limit', operator: '$lte', type: 'number' },
    'min_age_limit': { dbField: 'age_limit', operator: '$gte', type: 'number' },
    'min_likes':     { dbField: 'likes',     operator: '$gte', type: 'number' },

    'min_average_rating': { dbField: 'average_rating', operator: '$gte', type: 'number' },
    'max_average_rating': { dbField: 'average_rating', operator: '$lte', type: 'number' },

    'min_review_count': { dbField: 'review_count', operator: '$gte', type: 'number' },
    'max_review_count': { dbField: 'review_count', operator: '$lte', type: 'number' },
};

/**
 * Builds a MongoDB filter object from raw query params using searchFilterMap.
 * Unrecognized keys are ignored. Filters on the same dbField are merged.
 */
contentSchema.statics.buildQuery = function(rawQuery)
{
    const dbFilter = {};
    const map = this.searchFilterMap;

    for (const [key, value] of Object.entries(rawQuery))
    {
        if (!map[key] || value === undefined || value === null || value === "") continue;

        const { dbField, operator, type } = map[key];

        if (type === 'date')
        {
            if (!dbFilter[dbField]) dbFilter[dbField] = {};
            dbFilter[dbField][operator] = new Date(value);
        }
        else if (type === 'number')
        {
            if (!dbFilter[dbField]) dbFilter[dbField] = {};
            dbFilter[dbField][operator] = Number(value);
        }
        else if (type === 'exact')
        {
            dbFilter[dbField] = value;
        }
        else if (type === 'array')
        {
            const values = Array.isArray(value) ? value : value.split(',').map(v => v.trim()).filter(v => v !== '');
            if (!dbFilter[dbField]) dbFilter[dbField] = {};
            dbFilter[dbField][operator] = values;

            if (operator === '$all')
            {
                dbFilter[dbField]['$size'] = new Set(values).size;
            }
        }
        else if (type === 'string')
        {
            dbFilter[dbField] = { $regex: regexPatternBuilders[operator](value), $options: 'i' };
        }
    }

    return dbFilter;
};

module.exports = mongoose.model("Content", contentSchema);