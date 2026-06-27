const express = require('express');
const router = express.Router();
const userController = require('../controllers/user_controller');
const adminController = require('../controllers/admin_controller');
const { tokenVerification, removeTokenRequest } = require('../middlewares/token_manager');
const { adminAuthorization, adminAuthorizationPermissionLevel, Premmision_Level } = require('../middlewares/permission_manager');

// --- Public routes: No authentication required ---

// Register a new user and create their default profile
router.post('/register', userController.register); 

// Authenticate user credentials and return a token
router.post('/login', userController.login);

// --- Protected routes: Require valid token authentication ---

// Retrieve the current user's profile information
router.get('/get', tokenVerification, userController.getUser);

// Update user details like full name, phone, etc.
router.put('/update', tokenVerification, userController.updateUser);

// Invalidate or clear the current user's token
router.post('/logout', removeTokenRequest);

// --- Administrative routes: Require both a valid token and admin privileges ---

// Promote a user to admin or remove admin privileges
router.patch('/set_permission_level', tokenVerification, adminAuthorization, adminController.setPermissionLevel);

// Search for users based on specific criteria (admin only)
router.get('/search', tokenVerification, adminAuthorization, adminController.searchUsers);

// Permanently delete a user account by their ID (super admin only)
router.delete('/delete', tokenVerification, adminAuthorizationPermissionLevel(Premmision_Level.SUPER_ADMIN), adminController.deleteUser);

module.exports = router;