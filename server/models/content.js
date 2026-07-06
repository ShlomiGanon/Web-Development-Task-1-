const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
{
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    cover_image_name: { type: String, default: "UNDEFINED_COVER.png" },
    type: { type: String, required: true, enum: ["movie", "series"] },
    categories: { type: [String], default: [] },
    release_date: { type: Date, required: true },
    age_limit: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    videoUrl: { type: String, default: "UNDEFINED_VIDEO.mp4" }
},
{
    timestamps: true
});

// Indexes for common filter/sort operations
contentSchema.index({ type: 1 });
contentSchema.index({ categories: 1 });
contentSchema.index({ release_date: 1 });
contentSchema.index({ age_limit: 1 });
contentSchema.index({ likes: -1 }); // Critical for "Top 10" queries

// --- Search / filtering support (same pattern as User.buildQuery) ---

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const regexPatternBuilders = {
    regex_start:    (value) => `^${escapeRegex(value)}`,
    regex_end:      (value) => `${escapeRegex(value)}$`,
    regex_contains: (value) => `${escapeRegex(value)}`,
};

contentSchema.statics.searchFilterMap = {
    // String filters on title
    'title_starts':    { dbField: 'title', operator: 'regex_start',    type: 'string' },
    'title_ends':      { dbField: 'title', operator: 'regex_end',      type: 'string' },
    'title_contains':  { dbField: 'title', operator: 'regex_contains', type: 'string' },

    // Category filters - all three write to the same field and are merged, not overwritten,
    // so they can be combined in a single request (e.g. contain_category + exclude_category)
    'exact_category':   { dbField: 'categories', operator: '$all', type: 'array' },  // must contain ALL given categories
    'contain_category': { dbField: 'categories', operator: '$in',  type: 'array' },  // must contain AT LEAST ONE given category
    'exclude_category': { dbField: 'categories', operator: '$nin', type: 'array' },  // must contain NONE of the given categories

    // Exact match filters
    'type': { dbField: 'type', operator: '$eq', type: 'exact' },

    // Date range filters
    'released_after':  { dbField: 'release_date', operator: '$gte', type: 'date' },
    'released_before': { dbField: 'release_date', operator: '$lte', type: 'date' },

    // Numeric range filters
    'max_age_limit': { dbField: 'age_limit', operator: '$lte', type: 'number' },
    'min_age_limit': { dbField: 'age_limit', operator: '$gte', type: 'number' },
    'min_likes':     { dbField: 'likes',     operator: '$gte', type: 'number' },
};

/**
 * Builds a MongoDB filter object from raw query params, using searchFilterMap
 * to translate each recognized key into a { dbField, operator } pair.
 * Unrecognized keys are silently ignored.
 * Filters that target the same dbField (e.g. the three category filters) are
 * merged into a single object so they can be combined in one request.
 */
contentSchema.statics.buildQuery = function(rawQuery) {
    const dbFilter = {};
    const map = this.searchFilterMap;

    for (const [key, value] of Object.entries(rawQuery)) {
        if (!map[key]) continue;

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
            // Supports both a single value ("action") and a comma-separated list ("action,comedy")
            const values = Array.isArray(value) ? value : value.split(',').map(v => v.trim());
            if (!dbFilter[dbField]) dbFilter[dbField] = {};
            dbFilter[dbField][operator] = values;
        }
        else if (type === 'string')
        {
            dbFilter[dbField] = { $regex: regexPatternBuilders[operator](value), $options: 'i' };
        }
    }

    return dbFilter;
};

module.exports = mongoose.model("Content", contentSchema);