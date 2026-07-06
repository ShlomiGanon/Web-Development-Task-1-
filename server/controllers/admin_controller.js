const my_logger = require('../scripts/my_logger');
const { permissionManagerInstance, Permmision_Level } = require('../middlewares/permission_manager');
const User = require('../models/user');
const { safe_user } = require('./user_controller');
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
        if(!req.admin_user_id)return res.json({ success: false, data: null, message: 'setPermissionLevel: request object is missing admin_user_id' });
        const selected_user_id = req.target_user_id;
        const admin_user_id = req.admin_user_id;
        if(!selected_user_id)return res.json({ success: false, data: null, message: 'setPermissionLevel: request params is missing target_user_id' });
        if(!req.query.permission_level)return res.json({ success: false, data: null, message: 'setPermissionLevel: request query is missing permission_level' });
        const permission_level = parseInt(req.query.permission_level);
        if (permission_level > permissionManagerInstance.getPermissionLevel(admin_user_id))
        {
            return res.json({ success: false, data: null, message: 'cannot assign a permission level higher than your own!' });
        }
        else if(!permissionManagerInstance.isHavingPermissionLevel(admin_user_id, permissionManagerInstance.getPermissionLevel(selected_user_id)))
        {
            return res.json({ success: false, data: null, message: 'not having permission to set permission level for this user!' });
        }
        else if(permission_level == permissionManagerInstance.getPermissionLevel(selected_user_id))
        {
            return res.json({ success: false, data: null, message: 'target user already have the same permission level!' });
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
            const limit = req.query.limit || 10;
            const skip = req.query.skip || 0;
            const sort = req.query.sort || 'createdAt';
            const sortOrder = req.query.sortOrder || 'desc';
            const users = await User.find(query).limit(limit).skip(skip).sort({ [sort]: sortOrder });
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
        if(!target_user_id)return res.json({ success: false, data: null, message: 'deleteUser: request params is missing target_user_id' });
        if(!admin_user_id)return res.json({ success: false, data: null, message: 'deleteUser: request object is missing admin_user_id' });
        const user = await User.findByIdAndDelete(target_user_id);
        if(!user)return res.json({ success: false, message: 'User not found!' });
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