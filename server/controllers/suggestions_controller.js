const my_logger = require('../scripts/my_logger');
const User = require('../models/user');
const Profile = require('../models/profile');
const Content = require('../models/content');
const { toContentSummary } = require('./content_controller');

const getContentOthersEngagedWith = async (req, res) =>
    {
        try
        {
            const user_id = req.target_user_id;
            const current_profile = req.profile;
     
            const current_user = await User.findById(user_id);
            if(!current_user)
            {
                return res.json({ success: false, message: 'User not found' });
            }
     
            // Content the requesting profile already watched or liked - used later to
            // exclude it from the group-by result, so we don't recommend it back to them
            const own_interacted_ids = new Set();
            for(const entry of current_profile.last_watched)
            {
                own_interacted_ids.add(String(entry.content_id));
            }
            for(const content_id of current_profile.liked_content_ids)
            {
                own_interacted_ids.add(String(content_id));
            }
     
            // GROUP BY content_id across all OTHER profiles of this user.
            // Step 1: $match     - only profiles of this user, excluding the requesting profile
            // Step 2: $project   - extract just content_id out of last_watched (which stores
            //                      {episode_id, content_id} entries), then merge with liked_content_ids
            //                      into one flat array field of content_ids only
            // Step 3: $unwind    - turn that array into one row per content_id (like a SQL JOIN unnest)
            // Step 4: $group     - GROUP BY content_id, counting how many profile rows contributed each id
            const grouped_results = await Profile.aggregate(
            [
                { $match: { user_id: current_user._id, _id: { $ne: current_profile._id } } },
                { $project: { all_content_ids: { $concatArrays: [
                    { $map: { input: '$last_watched', as: 'entry', in: '$$entry.content_id' } },
                    '$liked_content_ids'
                ] } } },
                { $unwind: '$all_content_ids' },
                { $group: { _id: '$all_content_ids', profile_count: { $sum: 1 } } }
            ]);
     
            // Remove content the requesting profile already watched or liked
            const filtered_results = grouped_results.filter((row) => !own_interacted_ids.has(String(row._id)));
     
            const content_ids = filtered_results.map((row) => row._id);
     
            // Fetch the full Content documents for the remaining ids
            const contents = await Content.find({ _id: { $in: content_ids } });
     
            my_logger.ConsoleLog(`Content others engaged with retrieved successfully for user ${user_id}`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('getContentOthersEngagedWith', 'Content others engaged with retrieved successfully for user ' + user_id, { "profile_id": current_profile._id, "content_count": contents.length }, my_logger.Log_Level.INFO);
     
            return res.json({
                success: true,
                message: 'Content others engaged with retrieved successfully',
                content: contents.map(content => toContentSummary(content))
            });
        }
        catch (error)
        {
            my_logger.ConsoleLog(`Error getting content others engaged with: ${error}`, my_logger.Log_Level.ERROR);
            my_logger.OperationLog('getContentOthersEngagedWith', 'Error getting content others engaged with.', { "error": error }, my_logger.Log_Level.ERROR);
            res.json({ success: false, message: 'Internal server error' });
        }
    }

/**
 * Suggests the profile's top 3 picks based on its own taste, rather than
 * other profiles' activity: groups the categories of everything this profile
 * has watched or liked, takes its top 3 most common categories, then suggests
 * the 3 highest-rated other content items sharing those categories.
 * Relies on authorizeProfileAccess having attached req.profile.
 */
const getTopPicksForProfile = async (req, res) =>
    {
        try
        {
            const user_id = req.target_user_id;
            const current_profile = req.profile;

            // Content the profile already watched or liked - used both to build its
            // taste profile (top categories) and to exclude from the final suggestions
            const interacted_content_ids = [
                ...current_profile.last_watched.map((entry) => entry.content_id),
                ...current_profile.liked_content_ids
            ];

            if (interacted_content_ids.length === 0)
            {
                return res.json({ success: true, message: 'No watch or like history yet - nothing to base recommendations on', content: [] });
            }

            // GROUP BY category across all content this profile has watched or liked.
            // Step 1: $match   - only content this profile interacted with
            // Step 2: $unwind  - turn the categories array into one row per category
            // Step 3: $group   - GROUP BY category, counting how many interacted items had it
            // Step 4: $sort    - most common categories for this profile first
            // Step 5: $limit   - only the top 3 categories, to keep suggestions focused
            const top_categories = await Content.aggregate(
            [
                { $match: { _id: { $in: interacted_content_ids } } },
                { $unwind: '$categories' },
                { $group: { _id: '$categories', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]);

            const category_names = top_categories.map((row) => row._id);

            if (category_names.length === 0)
            {
                return res.json({ success: true, message: 'No categories found in watch/like history', content: [] });
            }

            // Fetch other content sharing those top categories, excluding anything
            // the profile already watched or liked, sorted by highest rated first -
            // limited to the top 3 picks
            const contents = await Content.find({
                categories: { $in: category_names },
                _id: { $nin: interacted_content_ids }
            }).sort({ average_rating: -1, likes: -1 }).limit(3);

            my_logger.ConsoleLog(`Top picks retrieved successfully for user ${user_id}`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('getTopPicksForProfile', 'Top picks retrieved successfully for user ' + user_id, { "profile_id": current_profile._id, "top_categories": category_names, "content_count": contents.length }, my_logger.Log_Level.INFO);

            return res.json({
                success: true,
                message: 'Top picks retrieved successfully',
                content: contents.map(content => toContentSummary(content))
            });
        }
        catch (error)
        {
            my_logger.ConsoleLog(`Error getting top picks: ${error}`, my_logger.Log_Level.ERROR);
            my_logger.OperationLog('getTopPicksForProfile', 'Error getting top picks.', { "error": error }, my_logger.Log_Level.ERROR);
            res.json({ success: false, message: 'Internal server error' });
        }
    }

module.exports = { getContentOthersEngagedWith, getTopPicksForProfile };