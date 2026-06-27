const express = require('express');
const router = express.Router();
const contentController = require('../controllers/content_controller');
const { tokenVerification } = require('../middlewares/token_manager');
const { adminAuthorization } = require('../middlewares/permission_manager');

// --- Administrative routes: Require both a valid token and admin privileges ---

// Add new media content to the database
router.post('/create', tokenVerification, adminAuthorization, contentController.createContent);

// Remove existing media content from the database
router.delete('/delete', tokenVerification, adminAuthorization, contentController.deleteContent);

// Update existing media content details
router.put('/update', tokenVerification, adminAuthorization, contentController.updateContent);

// --- Public routes ---

// Retrieve media information (specific item by ID or all items if no param)
router.get('/get', contentController.getContent);

// Search for media based on query filters (available to all users)
router.get('/search', contentController.searchContent);

module.exports = router;