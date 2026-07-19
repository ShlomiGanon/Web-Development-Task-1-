const my_logger = require('../scripts/my_logger');
const { permissionManagerInstance, Permmision_Level } = require('../middlewares/permission_manager');
const User = require('../models/user');
const Review = require('../models/review');
const Profile = require('../models/profile');
const { safe_user } = require('./user_controller');

// FIX: maps the public-facing sort keys (as sent by the frontend) to the actual
// Mongoose schema field names on User. Previously `req.query.sort` was passed straight
// into `.sort({ [sort]: sortOrder })` with no translation - so sorting by "fullName" or
// "birthday" (the frontend's field names) silently did nothing, since the actual schema
// fields are `full_name` and `birth_date`. MongoDB doesn't error when sorting by a
// nonexistent field - it just treats every document as equal for that key, so the sort
// had no visible effect. Only "createdAt" and "email" happened to work, since those
// names matched the real schema field names by coincidence.
// This also acts as a whitelist, so an arbitrary/unexpected `sort` value (e.g. an
// internal-only field like "password") can never be used to sort on.
const USER_SORT_FIELD_MAP =
{
    createdAt: 'createdAt',
    birthday: 'birth_date',
    fullName: 'full_name',
    email: 'email'
};

/**
 * Set permission level for a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { user_id: String }, req.params: { target_user_id: String } , req.query: { permission_level: number }
//res.json: { success: boolean, message: string }
const setPermissionLevel = async (req, res) => 
{
    try
    {
        if(!req.admin_user_id)return res.json({ success: false, message: 'setPermissionLevel: request object is missing admin_user_id' });
        const selected_user_id = req.target_user_id;
        const admin_user_id = req.admin_user_id;
        if(!selected_user_id)return res.json({ success: false, message: 'setPermissionLevel: request params is missing target_user_id' });
        if(req.body.permission_level === undefined)return res.json({ success: false, message: 'setPermissionLevel: request body is missing permission_level' });
        const permission_level = parseInt(req.body.permission_level);
        if (permission_level > permissionManagerInstance.getPermissionLevel(admin_user_id))
        {
            return res.json({ success: false, message: 'cannot assign a permission level higher than your own!' });
        }
        else if(!permissionManagerInstance.isHavingPermissionLevel(admin_user_id, permissionManagerInstance.getPermissionLevel(selected_user_id)))
        {
            return res.json({ success: false, message: 'not having permission to set permission level for this user!' });
        }
        else if(permission_level == permissionManagerInstance.getPermissionLevel(selected_user_id))
        {
            return res.json({ success: false, message: 'target user already have the same permission level!' });
        }
        if(permission_level == Permmision_Level.USER)
        {
            permissionManagerInstance.removePermissionLevel(selected_user_id);
            my_logger.ConsoleLog(`Permission level removed for user. [target_user_id: ${selected_user_id}]`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('setPermission', 'Permission level removed for user.', { "target_user_id": selected_user_id , "activated_by_user_id": admin_user_id}, my_logger.Log_Level.INFO);
            res.json({ success: true, message: 'Permission level removed for user.'});
        }
        else
        {
            permissionManagerInstance.setPermissionLevel(selected_user_id, permission_level);
            my_logger.ConsoleLog(`Permission level set for user. [target_user_id: ${selected_user_id}]`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('setPermission', 'Permission level set for user.', { "target_user_id": selected_user_id , "activated_by_user_id": admin_user_id}, my_logger.Log_Level.INFO);
            res.json({ success: true, message: 'Permission level set for user.' });
        }
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error setting admin privileges: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('setAdmin', 'Error setting admin privileges.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

const searchUsers = async (req, res) => 
    {
        try
        {
            const query = User.buildQuery(req.query);
    
            // limit/skip arrive from req.query as strings, so they must be
            // converted to numbers before being passed to mongoose.
            let limit = parseInt(req.query.limit, 10);
            if (isNaN(limit) || limit < 1) limit = 10;
    
            let skip = parseInt(req.query.skip, 10);
            if (isNaN(skip) || skip < 0) skip = 0;
    
            const requestedSort = req.query.sort || 'createdAt';
            const sort = USER_SORT_FIELD_MAP[requestedSort];
            if (!sort)
            {
                return res.json({ success: false, message: `Invalid sort field! [use one of: ${Object.keys(USER_SORT_FIELD_MAP).join(', ')}]` });
            }
    
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
    
            const users = await User.find(query)
                .limit(limit)
                .skip(skip)
                .sort({ [sort]: sortOrder });
    
            res.json({ success: true, message: 'Users searched successfully', users: users.map(user => safe_user(user)) });
        }
        catch (error)
        {
            my_logger.ConsoleLog(`Error searching users: ${error}`, my_logger.Log_Level.ERROR);
            res.json({ success: false, message: `Internal server error!` });
        }
    }

const deleteUser = async (req, res) => 
{
    try
    {
        const target_user_id = req.target_user_id;
        const admin_user_id = req.admin_user_id;
        if(!target_user_id)return res.json({ success: false, message: 'deleteUser: request params is missing target_user_id' });
        if(!admin_user_id)return res.json({ success: false, message: 'deleteUser: request object is missing admin_user_id' });

        const user = await User.findByIdAndDelete(target_user_id);
        if(!user)return res.json({ success: false, message: 'User not found!' });

        // Find all reviews written by this user, so we know which content ratings need recalculation
        const userReviews = await Review.find({ user_id: target_user_id }, 'content_id');
        const affectedContentIds = [...new Set(userReviews.map(r => r.content_id.toString()))];

        // Remove all reviews written by this user
        await Review.deleteMany({ user_id: target_user_id });

        // Remove all profiles owned by this user
        await Profile.deleteMany({ user_id: target_user_id });

        // Recalculate average_rating/review_count on content affected by the deleted reviews
        for(const contentId of affectedContentIds)
        {
            await Review.updateContentAverageRating(contentId);
        }

        res.json({ success: true, message: 'User deleted successfully' });
        my_logger.ConsoleLog(`User deleted successfully. [user_id: ${target_user_id}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('deleteUser', 'User deleted successfully.', { "deleted_user": safe_user(user), "activated_by_user_id": admin_user_id }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error deleting user: ${error}`, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: `Internal server error!` });
    }
}

module.exports = { setPermissionLevel, searchUsers, deleteUser };