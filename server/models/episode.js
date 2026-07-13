const mongoose = require("mongoose");

/**
 * Episode Schema
 * Represents an individual playable video, linked to a Content document.
 */
const episodeSchema = new mongoose.Schema(
{
    // Reference to the parent Content document
    content_id: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Content", 
        required: true,
        index: true 
    },

    // Season number
    season_number: 
    { 
        type: Number, 
        required: true, 
        default: 1 
    },

    // Episode number within the season
    episode_number: 
    { 
        type: Number, 
        required: true, 
        default: 1 
    },

    // Episode title
    title: 
    { 
        type: String, 
        trim: true 
    },

    // Filename/URL of the video asset
    videoUrl: 
    { 
        type: String, 
        default: "UNDEFINED_VIDEO.mp4" 
    }
},
{
    timestamps: true
});

// Compound unique index on content_id + season_number + episode_number
episodeSchema.index({ content_id: 1, season_number: 1, episode_number: 1 }, { unique: true });

/**
 * Returns the next episode after (currentSeason, currentEpisode) for the given content.
 */
episodeSchema.statics.getNextEpisode = async function(contentId, currentSeason, currentEpisode)
{
    let next = await this.findOne({
        content_id: contentId,
        season_number: currentSeason,
        episode_number: { $gt: currentEpisode }
    }).sort({ episode_number: 1 });

    if (!next)
    {
        next = await this.findOne({
            content_id: contentId,
            season_number: { $gt: currentSeason }
        }).sort({ season_number: 1, episode_number: 1 });
    }

    return next;
};

/**
 * Returns the episode before (currentSeason, currentEpisode) for the given content.
 */
episodeSchema.statics.getPrevEpisode = async function(contentId, currentSeason, currentEpisode)
{
    let prev = await this.findOne({
        content_id: contentId,
        season_number: currentSeason,
        episode_number: { $lt: currentEpisode }
    }).sort({ episode_number: -1 });

    if (!prev)
    {
        prev = await this.findOne({
            content_id: contentId,
            season_number: { $lt: currentSeason }
        }).sort({ season_number: -1, episode_number: -1 });
    }

    return prev;
};

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
episodeSchema.statics.searchFilterMap = 
{
    'content_id': { dbField: 'content_id', operator: '$eq', type: 'exact' },

    'title_starts':    { dbField: 'title', operator: 'regex_start',    type: 'string' },
    'title_ends':      { dbField: 'title', operator: 'regex_end',      type: 'string' },
    'title_contains':  { dbField: 'title', operator: 'regex_contains', type: 'string' },

    'season': { dbField: 'season_number', operator: '$eq', type: 'number' },

    'from_season': { dbField: 'season_number', operator: '$gte', type: 'number' },
    'to_season':   { dbField: 'season_number', operator: '$lte', type: 'number' },

    'from_episode': { dbField: 'episode_number', operator: '$gte', type: 'number' },
    'to_episode':   { dbField: 'episode_number', operator: '$lte', type: 'number' },
};

/**
 * Builds a MongoDB filter object from raw query params using searchFilterMap.
 * Unrecognized keys are ignored. Filters on the same dbField are merged.
 */
episodeSchema.statics.buildQuery = function(rawQuery)
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

module.exports = mongoose.model("Episode", episodeSchema);