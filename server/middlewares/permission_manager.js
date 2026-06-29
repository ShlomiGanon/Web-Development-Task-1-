const my_logger = require('../scripts/my_logger');
const fs = require('fs');
const path = require('path');
const Permmision_Level = 
{
    SUPER_ADMIN: 2,
    ADMIN: 1,
    USER: 0
}

const PermissionLookup = Object.fromEntries(
    Object.entries(Permmision_Level).map(([key, val]) => [val, key])
);

class PermissionManager
{
    constructor(save_path = path.join(__dirname, '../data/permission_manager.json'))
    {
        this.authorized_list = {};
        this.save_path = save_path;
        this.load();
    }

    save()
    {
        fs.mkdirSync(path.dirname(this.save_path), { recursive: true });
        fs.writeFileSync(this.save_path, JSON.stringify(this.authorized_list, null, 2));
    }

    load()
    {
        if(!fs.existsSync(this.save_path))return;
        const data = fs.readFileSync(this.save_path, 'utf8');
        this.authorized_list = JSON.parse(data);
    }

    setPermissionLevel(admin_key, permission_level = Permmision_Level.ADMIN)
    {
        if (PermissionLookup[permission_level] === undefined) return false;
        if(permission_level < Permmision_Level.ADMIN)return false;
        this.authorized_list[admin_key] = permission_level;
        this.save();
        return true;
    }

    removePermissionLevel(admin_key)
    {
        if(!this.authorized_list[admin_key])return false;
        delete this.authorized_list[admin_key];
        this.save();
        return true;
    }

    isAdmin(admin_key)
    {
        return this.isHavingPermissionLevel(admin_key, Permmision_Level.ADMIN);
    }

    isHavingPermissionLevel(admin_key, permission_level_threshold)
    {
        const user_permission_level = this.getPermissionLevel(admin_key);
        if(user_permission_level < permission_level_threshold)return false;
        return true;
    }

    getPermissionLevel(admin_key)
    {
        return this.authorized_list[admin_key] || Permmision_Level.USER;
    }
}

const permissionManagerInstance = new PermissionManager()


const adminAuthorizationPermissionLevel = (permission_level_threshold = Permmision_Level.ADMIN) => {
    return (req, res, next) => 
    {
        const admin_key = req.user_id;
        if(!admin_key)
            return res.json({ success: false, data: null, message: 'the request object is missing user_id' });
        if (!permissionManagerInstance.isHavingPermissionLevel(admin_key, permission_level_threshold)) 
        {
            my_logger.ConsoleLog(`Admin authorization failed. [admin_key: ${admin_key}]`, my_logger.Log_Level.ERROR);
            my_logger.OperationLog('adminAuthorizationAbovePermissionLevel', 'Admin authorization failed.', { "admin_key": admin_key, "permission_level_threshold": permission_level_threshold }, my_logger.Log_Level.ERROR);
            return res.json({ 
                success: false, 
                data: null, 
                message: `you are not authorized to access this resource {required_level: ${permission_level_threshold}}` 
            });
        }
        my_logger.ConsoleLog(`Admin authorization successful. [admin_key: ${admin_key}]`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('adminAuthorization', 'Admin authorization successful.', { "admin_key": admin_key, "permission_level_threshold": permission_level_threshold }, my_logger.Log_Level.INFO);
        next();//continue to the next middleware or controller
    };
}

const adminAuthorization = adminAuthorizationPermissionLevel(Permmision_Level.ADMIN);

// const exportedData = { permissionManagerInstance, adminAuthorization, adminAuthorizationPermissionLevel, Permmision_Level };
// console.log("DEBUG: Exporting object:", exportedData);
module.exports = { 
    get permissionManagerInstance() {
        return permissionManagerInstance;
    },
    adminAuthorization, 
    adminAuthorizationPermissionLevel, 
    Permmision_Level
};