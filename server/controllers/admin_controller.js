const my_logger = require('../scripts/my_logger');
const { permissionManagerInstance, Premmision_Level } = require('../middlewares/permission_manager');

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
        if(!req.user_id)return res.json({ success: false, data: null, message: 'setPermissionLevel: request object is missing user_id' });
        const selected_user_id = req.params.target_user_id;
        if(!selected_user_id)return res.json({ success: false, data: null, message: 'setPermissionLevel: request params is missing target_user_id' });
        if(!req.query.permission_level)return res.json({ success: false, data: null, message: 'setPermissionLevel: request query is missing permission_level' });
        const permission_level = parseInt(req.query.permission_level);
        if(!permissionManagerInstance.isHavingPermissionLevel(req.user_id, permissionManagerInstance.getPermissionLevel(selected_user_id)))
        {
            return res.json({ success: false, data: null, message: 'not having permission to set permission level for this user!' });
        }
        else if(permission_level == permissionManagerInstance.getPermissionLevel(selected_user_id))
        {
            return res.json({ success: false, data: null, message: 'target user already have the same permission level!' });
        }
        if(permission_level == Premmision_Level.USER)
        {
            permissionManagerInstance.removePermissionLevel(selected_user_id);
            my_logger.ConsoleLog(`Permission level removed for user. [target_user_id: ${selected_user_id}]`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('setPermission', 'Permission level removed for user.', { "target_user_id": selected_user_id , "activated_by_user_id": req.user_id}, my_logger.Log_Level.INFO);
            res.json({ success: true, message: 'Permission level removed for user.'});
        }
        else
        {
            permissionManagerInstance.setPermissionLevel(selected_user_id, permission_level);
            my_logger.ConsoleLog(`Permission level set for user. [target_user_id: ${selected_user_id}]`, my_logger.Log_Level.INFO);
            my_logger.OperationLog('setPermission', 'Permission level set for user.', { "target_user_id": selected_user_id , "activated_by_user_id": req.user_id}, my_logger.Log_Level.INFO);
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

module.exports = { setPermissionLevel };