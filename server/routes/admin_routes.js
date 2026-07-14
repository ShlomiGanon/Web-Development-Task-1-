const express = require('express');
const router = express.Router();

const userController = require('../controllers/user_controller');
const profileController = require('../controllers/profile_controller');
const adminController = require('../controllers/admin_controller');
const contentController = require('../controllers/content_controller');
const reviewController = require('../controllers/review_controller');
const statisticsController = require('../controllers/statistics_controller');
const tokenManager = require('../middlewares/token_manager');
const { adminAuthorization, adminAuthorizationPermissionLevel, Permmision_Level } = require('../middlewares/permission_manager');
const { userAuthorization } = require('../middlewares/user_authorization');
const { contentAuthorization } = require('../middlewares/content_authorization');

// Every route in this file requires a valid token first - the specific
// admin-level check (adminAuthorization vs. SUPER_ADMIN) is applied per-route below
router.use(tokenManager.tokenVerification);

// --- User management ---

// Search for users based on specific criteria
router.get('/users', adminAuthorization, adminController.searchUsers);

// Retrieve a specific user's profile information
router.get('/users/:user_id', adminAuthorization, userAuthorization, userController.getUser);

// Update a specific user's profile information
router.put('/users/:user_id', adminAuthorization, userAuthorization, userController.updateUser);

// Permanently delete a user account (super admin only)
router.delete('/users/:user_id', adminAuthorizationPermissionLevel(Permmision_Level.SUPER_ADMIN), userAuthorization, adminController.deleteUser);

// Promote a user to admin or remove admin privileges
router.put('/users/:user_id/permission', adminAuthorization, userAuthorization, adminController.setPermissionLevel);

// Check the number of active tokens of a user
router.get('/users/:user_id/tokens_count', adminAuthorization, userAuthorization, tokenManager.CheckTokensCountRequest);

// Kick a user (invalidate all their tokens)
router.post('/users/:user_id/kick', adminAuthorization, userAuthorization, tokenManager.KickUserRequest);

// Ban a user
router.post('/users/:user_id/ban', adminAuthorization, userAuthorization, tokenManager.BanUserRequest);

// Check whether a user is currently banned
router.get('/users/:user_id/ban', adminAuthorization, userAuthorization, tokenManager.IsBannedRequest);

// Get the user who owns a specific profile
router.get('/profiles/:profileId/owner', adminAuthorization, profileController.findUserByProfileId);

// --- Content management ---

// Add new media content to the database
router.post('/content', adminAuthorization, contentController.createContent);

// Remove existing media content from the database
router.delete('/content/:contentId', adminAuthorization, contentAuthorization, contentController.deleteContent);

// Update existing media content details
router.put('/content/:contentId', adminAuthorization, contentAuthorization, contentController.updateContent);

// Add a new episode to a series
router.post('/content/:contentId/episodes', adminAuthorization, contentAuthorization, contentController.addEpisode);

// Update an existing episode's details
router.put('/content/:contentId/episodes/:episodeId', adminAuthorization, contentAuthorization, contentController.updateEpisode);

// Remove an episode from a series
router.delete('/content/:contentId/episodes/:episodeId', adminAuthorization, contentAuthorization, contentController.removeEpisode);

// Create or update a movie's single video (movies only - use the episode
// routes above for series)
router.put('/content/:contentId/movie-video', adminAuthorization, contentAuthorization, contentController.setMovieVideo);

// --- Review management ---

// Edit any review directly by its ID
router.put('/reviews/:reviewId', adminAuthorization, reviewController.adminUpdateReview);

// Delete any review directly by its ID
router.delete('/reviews/:reviewId', adminAuthorization, reviewController.adminRemoveReview);

// --- Statistics management ---
router.get('/users-statistics', adminAuthorization, statisticsController.getUsersStatistics);
router.get('/content-statistics', adminAuthorization, statisticsController.getContentStatistics);
router.get('/reviews-statistics', adminAuthorization, statisticsController.getReviewsStatistics);
module.exports = router;