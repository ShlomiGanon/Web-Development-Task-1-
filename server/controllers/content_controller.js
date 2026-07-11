const { ADD_IMDB_RATING_TO_CONTENT } = require('../scripts/constants');
const Content = require('../models/content');
const my_logger = require('../scripts/my_logger');
const { getImdbRating } = require('../scripts/imdb_ranking');
/**
 * Helper to convert a full Content document into the object exposed to the client.
 * Kept as a single choke point so fields like an average rating or review count
 * can be attached here later (once Reviews are implemented) without touching every caller.
 */
const to_content_summary = (content) =>
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
        videoUrl: content.videoUrl,
        createdAt: content.createdAt.toISOString()
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
//req.body: { title: String, type: String, release_date: Date, description?: String, cover_image_name?: String, categories?: [String], age_limit?: Number, videoUrl?: String }
//res.json: { success: boolean, message: string, content: Object }
const createContent = async (req, res) =>
{
    try
    {
        const { title, description, cover_image_name, type, categories, release_date, age_limit, videoUrl } = req.body;

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
            videoUrl
        });

        await content.save();

        res.json({ success: true, message: 'Content created successfully', content: to_content_summary(content) });
        my_logger.ConsoleLog(`Content created successfully. [content_id: ${content._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('createContent', 'Content created successfully.', { "admin_user_id": req.admin_user_id, "content": to_content_summary(content) }, my_logger.Log_Level.INFO);
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
        let imdb_rating = undefined;
        if(ADD_IMDB_RATING_TO_CONTENT)
        {
            try
            {
                const response = await getImdbRating(content.title, { type: content.type });
                if(!response.error)
                {
                    imdb_rating = response;
                }
                else
                {
                    imdb_rating = undefined;
                    my_logger.ConsoleLog(`Error getting IMDB rating: ${response.error}`, my_logger.Log_Level.ERROR);
                    my_logger.OperationLog('getContent', 'Error getting IMDB rating.', { "error": response.error }, my_logger.Log_Level.ERROR);
                }
            }
            catch (error)
            {
                my_logger.ConsoleLog(`Error getting IMDB rating: ${error}`, my_logger.Log_Level.ERROR);
                my_logger.OperationLog('getContent', 'Error getting IMDB rating.', { "error": error }, my_logger.Log_Level.ERROR);
                imdb_rating = undefined;
            }
        }
        res.json({ success: true, message: 'Content retrieved successfully' + (imdb_rating ? ' with IMDB rating: ' + imdb_rating : ''), content: to_content_summary(content), imdb_rating: imdb_rating });
        my_logger.ConsoleLog(`Content retrieved successfully. [content_id: ${content._id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getContent', 'Content retrieved successfully.', { "content_id": content._id, "imdb_rating": imdb_rating }, my_logger.Log_Level.INFO);
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
//req.body: { title?: String, description?: String, cover_image_name?: String, type?: String, categories?: [String], release_date?: Date, age_limit?: Number, videoUrl?: String }
//res.json: { success: boolean, message: string, content: Object }
const updateContent = async (req, res) =>
{
    try
    {
        const content = req.content;
        const { title, description, cover_image_name, type, categories, release_date, age_limit, videoUrl } = req.body;

        if (type !== undefined && type !== 'movie' && type !== 'series')
        {
            return res.json({ success: false, message: 'Type must be either "movie" or "series"' });
        }

        const old_data = to_content_summary(content);
        const changes = {};

        if (title !== undefined) { content.title = title; changes.title = title; }
        if (description !== undefined) { content.description = description; changes.description = description; }
        if (cover_image_name !== undefined) { content.cover_image_name = cover_image_name; changes.cover_image_name = cover_image_name; }
        if (type !== undefined) { content.type = type; changes.type = type; }
        if (categories !== undefined) { content.categories = categories; changes.categories = categories; }
        if (release_date !== undefined) { content.release_date = release_date; changes.release_date = release_date; }
        if (age_limit !== undefined) { content.age_limit = age_limit; changes.age_limit = age_limit; }
        if (videoUrl !== undefined) { content.videoUrl = videoUrl; changes.videoUrl = videoUrl; }

        if (Object.keys(changes).length === 0)
        {
            return res.json({ success: false, message: 'No changes to update' });
        }

        await content.save();

        res.json({ success: true, message: 'Content updated successfully', content: to_content_summary(content) });
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
        my_logger.OperationLog('deleteContent', 'Content deleted successfully.', { "admin_user_id": req.admin_user_id, "deleted_content": to_content_summary(content) }, my_logger.Log_Level.INFO);
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

        res.json({ success: true, message: 'Content searched successfully', content: contents.map(content => to_content_summary(content))});
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error searching content: ${error}`, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

module.exports = { createContent, getContent, updateContent, deleteContent, searchContent , to_content_summary };