const express = require('express');
const router = express.Router();
const contentController = require('../controllers/content_controller');
const { contentAuthorization } = require('../middlewares/content_authorization');

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