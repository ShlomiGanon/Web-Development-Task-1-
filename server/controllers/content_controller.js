const { ADD_IMDB_RATING_TO_CONTENT } = require('../scripts/constants');
const Content = require('../models/content');
const Episode = require('../models/episode');
const my_logger = require('../scripts/my_logger');
const { getImdbRating } = require('../scripts/imdb_ranking');
/**
 * Helper to convert a full Content document into the object exposed to the client.
 * Kept as a single choke point so fields like an average rating or review count
 * can be attached here later (once Reviews are implemented) without touching every caller.
 */
const toContentSummary = (content) =>
{
    return {
        id: content._id.toString(),
        title: content.title,
        description: content.description,
        cover_image_name: content.cover_image_name,
        type: content.type,
        categories: content.categories,
        release_date: content.release_date.toISOString(),
        age_limit: content.age_limit,
        likes: content.likes,
        createdAt: content.createdAt.toISOString(),
        imdb_rating: content.imdb_rating
    };
}

/**
 * Helper to convert a full Episode document into a lightweight object
 * containing only the fields exposed to the client. Video lives here,
 * not on Content - every piece of watchable media is an Episode
 * (including a movie's single season 1 / episode 1 entry).
 */
const toEpisodeSummary = (episode) =>
{
    return {
        id: episode._id,
        contentId: episode.content_id,
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        title: episode.title,
        videoUrl: episode.videoUrl
    };
}

/**
 * Create a new content item (admin only).
 * Required fields match the schema's required-without-default fields: title, type, release_date.
 * All other fields are optional and fall back to their schema defaults if omitted.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { title: String, type: String, release_date: Date, description?: String, cover_image_name?: String, categories?: [String], age_limit?: Number }
//res.json: { success: boolean, message: string, content: Object }
const createContent = async (req, res) =>
{
    try
    {
        const { title, description, cover_image_name, type, categories, release_date, age_limit } = req.body;

        if (!title) return res.json({ success: false, message: 'Title is required' });
        if (!type) return res.json({ success: false, message: 'Type is required' });
        if (type !== 'movie' && type !== 'series') return res.json({ success: false, message: 'Type must be either "movie" or "series"' });
        if (!release_date) return res.json({ success: false, message: 'Release date is required' });

        const content = new Content({

            title,
            description,
            cover_image_name,
            type,
            categories,
            release_date,
            age_limit,
            likes: 0
        });

        await content.save();

        res.json({ success: true, message: 'Content created successfully', content: toContentSummary(content) });
        my_logger.ConsoleLog(`Content created successfully. [content_id: ${content._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('createContent', 'Content created successfully.', { "admin_user_id": req.admin_user_id, "content": toContentSummary(content) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error creating content: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('createContent', 'Error creating content.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Get a single content item by ID.
 * Relies on contentAuthorization having already fetched and attached the document (req.content).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, content: Object }
const getContent = async (req, res) =>
{
    try
    {
        const content = req.content;
        if(ADD_IMDB_RATING_TO_CONTENT)
        {
            try
            {
                const response = await getImdbRating(content.title, { type: content.type, year: content.release_date.getFullYear() });
                if(!response.error)
                {
                    content.imdb_rating = response.imdbRating;
                }
                else
                {
                    my_logger.ConsoleLog(`Error getting IMDB rating: ${response.error}`, my_logger.Log_Level.ERROR);
                    my_logger.OperationLog('getContent', 'Error getting IMDB rating.', { "error": response.error }, my_logger.Log_Level.ERROR);
                }
            }
            catch (error)
            {
                my_logger.ConsoleLog(`Error getting IMDB rating: ${error}`, my_logger.Log_Level.ERROR);
                my_logger.OperationLog('getContent', 'Error getting IMDB rating.', { "error": error }, my_logger.Log_Level.ERROR);
            }
        }
        res.json({ success: true, message: 'Content retrieved successfully' + (content.imdb_rating ? ' with IMDB rating: ' + content.imdb_rating : ''), content: toContentSummary(content)});
        my_logger.ConsoleLog(`Content retrieved successfully. [content_id: ${content._id}]` + (content.imdb_rating ? ' with IMDB rating: ' + content.imdb_rating : ''), my_logger.Log_Level.INFO);
        my_logger.OperationLog('getContent', 'Content retrieved successfully.', { "content_id": content._id, "imdb_rating": content.imdb_rating }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting content: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getContent', 'Error getting content.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Update an existing content item (admin only).
 * Relies on contentAuthorization having already fetched and attached the document (req.content).
 * Since title, type, and release_date are required-without-default on the schema, an update
 * cannot clear them to empty/null - only replace them with another valid value.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { title?: String, description?: String, cover_image_name?: String, type?: String, categories?: [String], release_date?: Date, age_limit?: Number }
//res.json: { success: boolean, message: string, content: Object }
const updateContent = async (req, res) =>
{
    try
    {
        const content = req.content;
        const { title, description, cover_image_name, type, categories, release_date, age_limit } = req.body;

        if (type !== undefined && type !== 'movie' && type !== 'series')
        {
            return res.json({ success: false, message: 'Type must be either "movie" or "series"' });
        }

        const old_data = toContentSummary(content);
        const changes = {};

        if (title !== undefined) { content.title = title; changes.title = title; }
        if (description !== undefined) { content.description = description; changes.description = description; }
        if (cover_image_name !== undefined) { content.cover_image_name = cover_image_name; changes.cover_image_name = cover_image_name; }
        if (type !== undefined) { content.type = type; changes.type = type; }
        if (categories !== undefined) { content.categories = categories; changes.categories = categories; }
        if (release_date !== undefined) { content.release_date = release_date; changes.release_date = release_date; }
        if (age_limit !== undefined) { content.age_limit = age_limit; changes.age_limit = age_limit; }

        if (Object.keys(changes).length === 0)
        {
            return res.json({ success: false, message: 'No changes to update' });
        }

        await content.save();

        res.json({ success: true, message: 'Content updated successfully', content: toContentSummary(content) });
        my_logger.ConsoleLog(`Content updated successfully. [content_id: ${content._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('updateContent', 'Content updated successfully.', { "admin_user_id": req.admin_user_id, "content_id": content._id, "old_data": old_data, "changes": changes }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating content: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('updateContent', 'Error updating content.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Delete a content item (admin only).
 * Relies on contentAuthorization having already fetched and attached the document (req.content).
 * TODO: once Reviews are implemented, cascade-delete (or archive) reviews tied to this contentId.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string }
const deleteContent = async (req, res) =>
{
    try
    {
        const content = req.content;

        await Content.findByIdAndDelete(content._id);

        res.json({ success: true, message: 'Content deleted successfully' });
        my_logger.ConsoleLog(`Content deleted successfully. [content_id: ${content._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('deleteContent', 'Content deleted successfully.', { "admin_user_id": req.admin_user_id, "deleted_content": toContentSummary(content) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error deleting content: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('deleteContent', 'Error deleting content.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Search / list content items using query filters (public).
 * Uses the same buildQuery pattern as User.buildQuery - see models/content.js searchFilterMap
 * for the full list of supported query params (title_starts/ends/contains, exact_category,
 * contain_category, exclude_category, type, released_after/before, min/max_age_limit, min_likes).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.query: { ...searchFilterMap keys, limit?, skip?, sort?, sortOrder? }
//res.json: { success: boolean, message: string, content: Array }
const searchContent = async (req, res) =>
{
    try
    {
        const query = Content.buildQuery(req.query);
        const limit = req.query.limit || 20;
        const skip = req.query.skip || 0;
        const sort = req.query.sort || 'release_date';
        let sortOrder = 'desc';
        if(req.query.sortOrder == 'greater_to_smaller')
        {
            sortOrder = 'desc';
        }
        else if(req.query.sortOrder == 'smaller_to_greater')
        {
            sortOrder = 'asc';
        }
        else if (req.query.sortOrder)
        {
            return res.json({ success: false, message: 'Invalid sort order! [use greater_to_smaller or smaller_to_greater]' });
        }

        const contents = await Content.find(query).limit(limit).skip(skip).sort({ [sort]: sortOrder });

        res.json({ success: true, message: 'Content searched successfully', content: contents.map(content => toContentSummary(content))});
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error searching content: ${error}`, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Add a new episode to a series (admin only).
 * Relies on contentAuthorization having already fetched and attached req.content.
 * Rejected outright for content of type "movie" - only series have episodes.
 * The schema enforces a unique (content_id, season_number, episode_number) triple,
 * so a duplicate is reported as a clear message instead of a raw duplicate-key error.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { season_number: Number, episode_number: Number, title?: String, videoUrl?: String }
//res.json: { success: boolean, message: string, episode: Object }
const addEpisode = async (req, res) =>
{
    try
    {
        const content = req.content;

        if (content.type !== 'series')
        {
            return res.json({ success: false, message: 'Episodes can only be added to series' });
        }

        const { season_number, episode_number, title, videoUrl } = req.body;

        if (season_number === undefined || episode_number === undefined)
        {
            return res.json({ success: false, message: 'season_number and episode_number are required' });
        }

        let episode;

        try
        {
            episode = await Episode.create({
                content_id: content._id,
                season_number,
                episode_number,
                title,
                videoUrl
            });
        }
        catch (dbError)
        {
            if (dbError.code === 11000)
            {
                return res.json({ success: false, message: 'This season/episode number already exists for this content' });
            }

            throw dbError;
        }

        res.json({ success: true, message: 'Episode added successfully', episode: toEpisodeSummary(episode) });
        my_logger.ConsoleLog(`Episode added successfully. [content_id: ${content._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('addEpisode', 'Episode added successfully.', { "admin_user_id": req.admin_user_id, "content_id": content._id, "episode": toEpisodeSummary(episode) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error adding episode: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('addEpisode', 'Error adding episode.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}


//req.body: { videoUrl: String }
//res.json: { success: boolean, message: string, episode: Object }
const setMovieVideo = async (req, res) =>
{
    try
    {
        const content = req.content;

        if (content.type !== 'movie')
        {
            return res.json({ success: false, message: 'This endpoint is only for movies - use the episode endpoints for series' });
        }

        const { videoUrl } = req.body;

        if (!videoUrl)
        {
            return res.json({ success: false, message: 'videoUrl is required' });
        }

        let episode = await Episode.findOne({ content_id: content._id, season_number: 1, episode_number: 1 });

        if (episode)
        {
            episode.videoUrl = videoUrl;
            await episode.save();
        }
        else
        {
            episode = await Episode.create({
                content_id: content._id,
                season_number: 1,
                episode_number: 1,
                videoUrl: videoUrl
            });
        }

        res.json({ success: true, message: 'Movie video set successfully', episode: toEpisodeSummary(episode) });
        my_logger.ConsoleLog(`Movie video set successfully. [content_id: ${content._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('setMovieVideo', 'Movie video set successfully.', { "admin_user_id": req.admin_user_id, "content_id": content._id, "episode": toEpisodeSummary(episode) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error setting movie video: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('setMovieVideo', 'Error setting movie video.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Update an existing episode's details (admin only).
 * Relies on contentAuthorization having attached req.content and req.episode
 * (i.e. the route must carry both contentId and episodeId).
 * Not restricted by content type - a movie's single episode can be edited too.
 * The schema enforces a unique (content_id, season_number, episode_number) triple,
 * so changing season_number/episode_number into a colliding pair is reported as
 * a clear message instead of a raw duplicate-key error.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { season_number?: Number, episode_number?: Number, title?: String, videoUrl?: String }
//res.json: { success: boolean, message: string, episode: Object }
const updateEpisode = async (req, res) =>
{
    try
    {
        const content = req.content;
        const episode = req.episode;

        if (!episode)
        {
            return res.json({ success: false, message: 'Episode ID is required' });
        }

        const { season_number, episode_number, title, videoUrl } = req.body;

        const old_data = toEpisodeSummary(episode);
        const changes = {};

        if (season_number !== undefined) { episode.season_number = season_number; changes.season_number = season_number; }
        if (episode_number !== undefined) { episode.episode_number = episode_number; changes.episode_number = episode_number; }
        if (title !== undefined) { episode.title = title; changes.title = title; }
        if (videoUrl !== undefined) { episode.videoUrl = videoUrl; changes.videoUrl = videoUrl; }

        if (Object.keys(changes).length === 0)
        {
            return res.json({ success: false, message: 'No changes to update' });
        }

        try
        {
            await episode.save();
        }
        catch (dbError)
        {
            if (dbError.code === 11000)
            {
                return res.json({ success: false, message: 'This season/episode number already exists for this content' });
            }

            throw dbError;
        }

        res.json({ success: true, message: 'Episode updated successfully', episode: toEpisodeSummary(episode) });
        my_logger.ConsoleLog(`Episode updated successfully. [content_id: ${content._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('updateEpisode', 'Episode updated successfully.', { "admin_user_id": req.admin_user_id, "content_id": content._id, "episode_id": episode._id, "old_data": old_data, "changes": changes }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating episode: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('updateEpisode', 'Error updating episode.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Remove an episode from a series (admin only).
 * Relies on contentAuthorization having attached req.content and req.episode
 * (i.e. the route must carry both contentId and episodeId).
 * TODO: this does not clean up references to the deleted episode in profiles'
 * last_watched entries or in Reviews - both will keep a dangling episode_id.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string }
const removeEpisode = async (req, res) =>
{
    try
    {
        const content = req.content;
        const episode = req.episode;

        if (!episode)
        {
            return res.json({ success: false, message: 'Episode ID is required' });
        }

        await Episode.findByIdAndDelete(episode._id);

        res.json({ success: true, message: 'Episode removed successfully' });
        my_logger.ConsoleLog(`Episode removed successfully. [content_id: ${content._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('removeEpisode', 'Episode removed successfully.', { "admin_user_id": req.admin_user_id, "content_id": content._id, "removed_episode": toEpisodeSummary(episode) }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error removing episode: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('removeEpisode', 'Error removing episode.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Get the next episode after req.episode, within the same content.
 * Relies on contentAuthorization having attached req.content and req.episode
 * (i.e. the route must carry both contentId and episodeId).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, episode?: Object }
const getNextEpisodeRequest = async (req, res) =>
{
    const content = req.content;
    const episode = req.episode;

    try
    {
        if (!episode)
        {
            return res.json({ success: false, message: "Episode ID is required" });
        }

        const nextEpisode = await Episode.getNextEpisode(content._id, episode.season_number, episode.episode_number);

        if (!nextEpisode)
        {
            return res.json({ success: false, message: "No next episode found" });
        }

        res.json({ success: true, message: "Next episode found", episode: toEpisodeSummary(nextEpisode) });
        my_logger.ConsoleLog(`Next episode found successfully. [content_id: ${content._id}, from_episode_id: ${episode._id}, next_episode_id: ${nextEpisode._id}]`, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting next episode: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getNextEpisode', 'Error getting next episode.', { "content_id": content && content._id, "episode_id": episode && episode._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Get the previous episode before req.episode, within the same content.
 * Relies on contentAuthorization having attached req.content and req.episode
 * (i.e. the route must carry both contentId and episodeId).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, episode?: Object }
const getPrevEpisodeRequest = async (req, res) =>
{
    const content = req.content;
    const episode = req.episode;

    try
    {
        if (!episode)
        {
            return res.json({ success: false, message: "Episode ID is required" });
        }

        const prevEpisode = await Episode.getPrevEpisode(content._id, episode.season_number, episode.episode_number);

        if (!prevEpisode)
        {
            return res.json({ success: false, message: "No previous episode found" });
        }

        res.json({ success: true, message: "Previous episode found", episode: toEpisodeSummary(prevEpisode) });
        my_logger.ConsoleLog(`Previous episode found successfully. [content_id: ${content._id}, from_episode_id: ${episode._id}, prev_episode_id: ${prevEpisode._id}]`, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting previous episode: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getPrevEpisode', 'Error getting previous episode.', { "content_id": content && content._id, "episode_id": episode && episode._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Get all episodes of a series, grouped by season.
 * Returns an array of arrays: index 0 is season 1's episodes, index 1 is
 * season 2's, etc. Only valid for content of type "series" - movies have
 * no episodes and are rejected outright.
 * Relies on contentAuthorization having attached req.content.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, seasons?: Array<Array<Object>> }
const getAllEpisodesRequest = async (req, res) =>
{
    const content = req.content;

    try
    {
        if (content.type !== 'series')
        {
            return res.json({ success: false, message: "This content is not a series" });
        }

        const episodes = await Episode.find({ content_id: content._id }).sort({ season_number: 1, episode_number: 1 });

        const seasons = [];

        for (const episode of episodes)
        {
            const seasonIndex = episode.season_number - 1;

            if (!seasons[seasonIndex])
            {
                seasons[seasonIndex] = [];
            }

            seasons[seasonIndex].push(toEpisodeSummary(episode));
        }

        // Fill any gaps (e.g. a season with zero episodes stored) so the array has no holes
        for (let i = 0; i < seasons.length; i++)
        {
            if (!seasons[i])
            {
                seasons[i] = [];
            }
        }

        res.json({ success: true, message: "Episodes retrieved successfully", seasons: seasons });
        my_logger.ConsoleLog(`All episodes retrieved successfully. [content_id: ${content._id}, season_count: ${seasons.length}]`, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting all episodes: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getAllEpisodes', 'Error getting all episodes.', { "content_id": content && content._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

/**
 * Get a single episode by ID.
 * Relies on contentAuthorization having attached req.content and req.episode
 * (i.e. the route must carry both contentId and episodeId).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: { success: boolean, message: string, episode?: Object }
const getEpisodeRequest = async (req, res) =>
{
    const content = req.content;
    const episode = req.episode;

    try
    {
        if (!episode)
        {
            return res.json({ success: false, message: "Episode ID is required" });
        }

        res.json({ success: true, message: "Episode retrieved successfully", episode: toEpisodeSummary(episode) });
        my_logger.ConsoleLog(`Episode retrieved successfully. [content_id: ${content._id}, episode_id: ${episode._id}]`, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting episode: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getEpisode', 'Error getting episode.', { "content_id": content && content._id, "episode_id": episode && episode._id, "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: "Internal server error" });
    }
}

module.exports =
{
    createContent,
    getContent,
    updateContent,
    deleteContent,
    searchContent,
    addEpisode,
    setMovieVideo,
    updateEpisode,
    removeEpisode,
    getEpisodeRequest,
    getNextEpisodeRequest,
    getPrevEpisodeRequest,
    getAllEpisodesRequest,
    toContentSummary,
    toEpisodeSummary
};