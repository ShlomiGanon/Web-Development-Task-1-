const express = require('express');
const router = express.Router();
const userController = require('../controllers/user_controller');
const adminController = require('../controllers/admin_controller');
const tokenManager = require('../middlewares/token_manager');
const { adminAuthorization, adminAuthorizationPermissionLevel, Permmision_Level } = require('../middlewares/permission_manager');
const { userAuthorization } = require('../middlewares/user_authorization');
// --- Public routes: No authentication required ---

// Register a new user and create their default profile
router.post('/register', userController.register); 

// Authenticate user credentials and return a token
router.post('/login', userController.login);

// --- Protected routes: Require valid token authentication ---

// Invalidate or clear the current user's token
router.post('/logout', tokenManager.removeTokenRequest);

// Retrieve the current user's profile information
router.get('/me', tokenManager.tokenVerification, userController.getUser);

// Update user details like full name, phone, etc.
router.put('/me', tokenManager.tokenVerification, userController.updateUser);

// --- Administrative routes: Require both a valid token and admin privileges ---
// Search for users based on specific criteria (admin only)
router.get('/', tokenManager.tokenVerification, adminAuthorization, adminController.searchUsers);

// Retrieve a specific user's profile information (admin only)
router.get('/:user_id', tokenManager.tokenVerification, adminAuthorization , userAuthorization, userController.getUser);

// Update a specific user's profile information (admin only)
router.put('/:user_id', tokenManager.tokenVerification, adminAuthorization , userAuthorization, userController.updateUser);

// Permanently delete a user account by their ID (super admin only)
router.delete('/:user_id', tokenManager.tokenVerification, adminAuthorizationPermissionLevel(Permmision_Level.SUPER_ADMIN), userAuthorization, adminController.deleteUser);

// Promote a user to admin or remove admin privileges
router.put('/:user_id/permission', tokenManager.tokenVerification, adminAuthorization, userAuthorization, adminController.setPermissionLevel);

// Check the number of tokens of a user
router.get('/:user_id/tokens_count', tokenManager.tokenVerification, adminAuthorization, userAuthorization, tokenManager.CheckTokensCountRequest);

// Kick a user
router.post('/:user_id/kick', tokenManager.tokenVerification, adminAuthorization, userAuthorization, tokenManager.KickUserRequest);

// Ban a user
router.post('/:user_id/ban', tokenManager.tokenVerification, adminAuthorization, userAuthorization, tokenManager.BanUserRequest);

router.get('/:user_id/ban', tokenManager.tokenVerification, adminAuthorization, userAuthorization, tokenManager.IsBannedRequest);
module.exports = router;