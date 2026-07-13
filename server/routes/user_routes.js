const express = require('express');
const router = express.Router();
const userController = require('../controllers/user_controller');
const tokenManager = require('../middlewares/token_manager');

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

module.exports = router;