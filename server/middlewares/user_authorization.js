const mongoose = require('mongoose');
const User = require('../models/user');

/**
 * Middleware used on admin routes that act on a target user by ID
 * (e.g. GET /:user_id, PUT /:user_id).
 * Validates the user_id route param, confirms the user exists, and
 * overwrites req.target_user_id with it — so the shared userController
 * functions (getUser/updateUser), which always read from req.user_id,
 * operate on the target user instead of the requesting admin.
 * Must run after tokenVerification and adminAuthorization.
 */
const userAuthorization = async (req, res, next) =>
{
    try
    {
        const targetUserId = req.params.user_id;

        if (!targetUserId)
        {
            return res.json({ success: false, message: "User ID is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(targetUserId))
        {
            return res.json({ success: false, message: "Invalid user ID format" });
        }

        const user = await User.findById(targetUserId);

        if (!user)
        {
            return res.json({ success: false, message: "User not found" });
        }

        req.target_user_id = targetUserId;

        next();
    }
    catch (error)
    {
        console.error('Error in userAuthorization:', error);
        return res.json({ success: false, message: "Internal server error" });
    }
}

module.exports = { userAuthorization };