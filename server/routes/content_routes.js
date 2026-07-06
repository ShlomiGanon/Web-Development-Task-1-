const express = require('express');
const router = express.Router();
const contentController = require('../controllers/content_controller');
const { tokenVerification } = require('../middlewares/token_manager');
const { adminAuthorization } = require('../middlewares/permission_manager');
const { contentAuthorization } = require('../middlewares/content_authorization');

// --- Administrative routes: Require both a valid token and admin privileges ---

// Add new media content to the database
router.post('/', tokenVerification, adminAuthorization, contentController.createContent);

// Remove existing media content from the database
router.delete('/:contentId', tokenVerification, adminAuthorization, contentAuthorization, contentController.deleteContent);

// Update existing media content details
router.put('/:contentId', tokenVerification, adminAuthorization, contentAuthorization, contentController.updateContent);

// --- Public routes ---

// Retrieve media information (specific item by ID)
router.get('/:contentId', contentAuthorization, contentController.getContent);

// Retrieve media information (all items, with optional search/filter query params)
router.get('/', contentController.searchContent);

module.exports = router;