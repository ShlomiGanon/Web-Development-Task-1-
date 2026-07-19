const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const { IMDB_API_INFO } = require("../scripts/imdb_api");
const my_logger = require("../scripts/my_logger");
const { ADD_IMDB_API_TO_CONTENT } = require("../scripts/constants");

// models/ and public/ are sibling folders at the project root.
const COVERS_DIR = path.join(__dirname, "..", "public", "assets", "covers");

// Shared defaults - referenced both in the schema and in MISSING_SENTINELS,
// so changing a default only needs to happen in one place.
const DEFAULT_AGE_LIMIT = 0;
const DEFAULT_COVER_IMAGE_NAME = "UNDEFINED_COVER.png";

// =====================================================================
// Schema
// =====================================================================

/**
 * Content Schema
 * Represents a top-level piece of content on the platform (a movie or a series).
 */
const contentSchema = new mongoose.Schema(
{
    title: 
    { 
        type: String, 
        required: true, 
        trim: true 
    },

    description: 
    { 
        type: String, 
        default: "" 
    },

    // Filename only (not a path); actual files live under COVERS_DIR.
    cover_image_name: 
    { 
        type: String, 
        default: DEFAULT_COVER_IMAGE_NAME 
    },

    type: 
    { 
        type: String, 
        required: true, 
        enum: ["movie", "series"] 
    },

    categories: 
    { 
        type: [String], 
        default: [] 
    },

    release_date: 
    { 
        type: Date, 
        required: true 
    },

    age_limit: 
    { 
        type: Number, 
        default: DEFAULT_AGE_LIMIT 
    },

    // Kept in sync by Review's post-save/delete hooks.
    likes: 
    { 
        type: Number, 
        default: 0 
    },

    // Kept in sync by Review's post-save/delete hooks.
    average_rating: 
    { 
        type: Number, 
        default: 0 
    },

    // Kept in sync by Review's post-save/delete hooks.
    review_count: 
    { 
        type: Number, 
        default: 0 
    },

    // IMDB-derived fields below; null until fetched successfully.
    imdb_rating: 
    { 
        type: Number, 
        default: null 
    },

    imdb_votes: 
    { 
        type: Number, 
        default: null 
    },

    actors: 
    { 
        type: [String], 
        default: [] 
    },

    // IMDB title ID, e.g. "tt1234567"
    imdb_id: 
    { 
        type: String, 
        default: null 
    }
},
{
    timestamps: true
});

// =====================================================================
// Indexes
// =====================================================================

contentSchema.index({ type: 1 });
contentSchema.index({ categories: 1 });
contentSchema.index({ release_date: 1 });
contentSchema.index({ age_limit: 1 });
contentSchema.index({ likes: -1 });
contentSchema.index({ average_rating: -1 });

// =====================================================================
// Search / filtering support
// =====================================================================

// Escapes regex special characters in a value.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Builds the regex pattern string for each string operator.
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

// =====================================================================
// Content creation helpers
// =====================================================================

// Fields whose schema default isn't "empty", so a plain empty-value check
// can't tell "never provided" from "happens to match the default". These
// values are also treated as missing, so the IMDB fill-in still applies.
const MISSING_SENTINELS = 
{
    age_limit: DEFAULT_AGE_LIMIT,
    cover_image_name: DEFAULT_COVER_IMAGE_NAME,
};

const isFieldMissing = (field, value) =>
{
    if (value === undefined || value === null || value === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (field in MISSING_SENTINELS && value === MISSING_SENTINELS[field]) return true;
    return false;
};

// "Black Rabbit" -> "Black_Rabbit.jpg" (spaces -> underscores, matching the
// existing cover files' naming convention).
const buildCoverFilename = (title, extension) =>
{
    const safeTitle = title.trim().replace(/\s+/g, "_");
    return `${safeTitle}.${extension}`;
};

// Downloads the poster at posterUrl into COVERS_DIR.
// Returns the saved filename (not a path).
async function downloadCoverImage(posterUrl, title)
{
    const imageResponse = await fetch(posterUrl);
    if (!imageResponse.ok)
    {
        throw new Error(`Network error fetching poster: ${imageResponse.status}`);
    }

    const contentType = imageResponse.headers.get("content-type") || "";
    const extension = contentType.includes("png") ? "png" : "jpg";
    const filename = buildCoverFilename(title, extension);

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    await fs.mkdir(COVERS_DIR, { recursive: true });
    await fs.writeFile(path.join(COVERS_DIR, filename), buffer);

    return filename;
}

// =====================================================================
// Static methods
// =====================================================================

/**
 * Adds new content.
 *
 * Required: title, type, release_date.
 *
 * Optional: description, cover_image_name, categories, age_limit, actors.
 * If omitted/empty, these are filled from IMDB (only when ADD_IMDB_API_TO_CONTENT
 * is true) without overwriting a value the caller already provided.
 *
 * NOT accepted as parameters - always computed at runtime or IMDB-only:
 * - imdb_rating, imdb_votes, imdb_id: only ever come from IMDB.
 * - likes, average_rating, review_count: kept in sync by Review's hooks.
 *
 * Failure handling:
 * - create() failure -> thrown to the caller as a clear error.
 * - IMDB request failure (network/timeout) -> logged, content still returned.
 * - IMDB responds but finds no match -> logged as a warning, content still returned.
 * - Poster download failure -> logged as a warning; other IMDB fields are still saved.
 */
contentSchema.statics.addNewContent = async function(
    title, type, release_date,
    description = undefined, cover_image_name = undefined, categories = undefined, age_limit = undefined, actors = undefined
)
{
    let content;
    try
    {
        content = await this.create({
            title, type, release_date,
            description, cover_image_name, categories, age_limit, actors
        });
    }
    catch (err)
    {
        throw new Error(`Failed to create content: ${err.message}`, { cause: err });
    }
    //if ADD_IMDB_API_TO_CONTENT is false, return the content without fetching IMDB data
    if (!ADD_IMDB_API_TO_CONTENT)
    {
        return content;
    }

    let api_response;
    try
    {
        api_response = await IMDB_API_INFO(content.title, { type: content.type, year: content.release_date.getFullYear() });
    }
    catch (err)
    {
        my_logger.ConsoleLog(`Failed to fetch IMDB data due to a request error: ${err.message}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('addNewContent', 'IMDB API request failed.', { "error": err.message }, my_logger.Log_Level.ERROR);
        return content;
    }

    if (api_response.error)
    {
        my_logger.ConsoleLog(`IMDB data was not received for "${content.title}": ${api_response.error}`, my_logger.Log_Level.WARN);
        my_logger.OperationLog('addNewContent', 'IMDB data not received.', { "reason": api_response.error }, my_logger.Log_Level.WARN);
        return content;
    }

    let changed = false;
    const fillIfMissing = (field, apiValue) =>
    {
        if (isFieldMissing(field, content[field]) && apiValue !== undefined && apiValue !== null)
        {
            content[field] = apiValue;
            changed = true;
        }
    };

    fillIfMissing('description', api_response.description);
    fillIfMissing('imdb_rating', api_response.imdbRating);
    fillIfMissing('imdb_votes', api_response.votes);
    fillIfMissing('actors', api_response.actors);
    fillIfMissing('imdb_id', api_response.imdbID);
    fillIfMissing('categories', api_response.categories);
    fillIfMissing('age_limit', api_response.age_limit);

    // Handled separately: can fail independently (network/disk) without
    // blocking the rest of the IMDB data from being saved.
    if (isFieldMissing('cover_image_name', content.cover_image_name) && api_response.poster_url)
    {
        try
        {
            const filename = await downloadCoverImage(api_response.poster_url, content.title);
            content.cover_image_name = filename;
            changed = true;
        }
        catch (err)
        {
            my_logger.ConsoleLog(`Failed to download cover image for "${content.title}": ${err.message}`, my_logger.Log_Level.WARN);
            my_logger.OperationLog('addNewContent', 'Cover image download failed.', { "error": err.message }, my_logger.Log_Level.WARN);
        }
    }

    if (changed)
    {
        await content.save();
    }

    return content;
}

module.exports = mongoose.model("Content", contentSchema);