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

// Add a new episode to a series
router.post('/:contentId/episodes', tokenVerification, adminAuthorization, contentAuthorization, contentController.addEpisode);

// Update an existing episode's details
router.put('/:contentId/episodes/:episodeId', tokenVerification, adminAuthorization, contentAuthorization, contentController.updateEpisode);

// Remove an episode from a series
router.delete('/:contentId/episodes/:episodeId', tokenVerification, adminAuthorization, contentAuthorization, contentController.removeEpisode);

// --- Public routes ---

// Retrieve media information (specific item by ID)
router.get('/:contentId', contentAuthorization, contentController.getContent);

// Retrieve media information (all items, with optional search/filter query params)
router.get('/', contentController.searchContent);

// Retrieve all episodes of a series, grouped by season
router.get('/:contentId/episodes', contentAuthorization, contentController.getAllEpisodesRequest);

// Retrieve a specific episode by ID
router.get('/:contentId/episodes/:episodeId', contentAuthorization, contentController.getEpisodeRequest);

// Retrieve the episode after a given one, within the same content
router.get('/:contentId/episodes/:episodeId/next', contentAuthorization, contentController.getNextEpisodeRequest);

// Retrieve the episode before a given one, within the same content
router.get('/:contentId/episodes/:episodeId/prev', contentAuthorization, contentController.getPrevEpisodeRequest);

module.exports = router;