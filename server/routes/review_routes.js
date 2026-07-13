const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review_controller');
const { tokenVerification } = require('../middlewares/token_manager');
const { adminAuthorization } = require('../middlewares/permission_manager');
const { authorizeProfileAccess } = require('../middlewares/profile_authorization');
const { contentAuthorization } = require('../middlewares/content_authorization');

// --- Owner routes: must be logged in and own the profile ---

// Add a review (rating + optional comment) for a specific episode
router.post('/:profileId/:contentId/:episodeId', tokenVerification, authorizeProfileAccess, contentAuthorization, reviewController.addReview);

// Edit the profile's own review for a specific episode
router.put('/:profileId/:contentId/:episodeId', tokenVerification, authorizeProfileAccess, contentAuthorization, reviewController.updateReview);

// Remove the profile's own review for a specific episode
router.delete('/:profileId/:contentId/:episodeId', tokenVerification, authorizeProfileAccess, contentAuthorization, reviewController.removeReview);

// --- Administrative routes: act on any review directly by its ID ---

// Edit any review (admin only)
router.put('/admin/:reviewId', tokenVerification, adminAuthorization, reviewController.adminUpdateReview);

// Delete any review (admin only)
router.delete('/admin/:reviewId', tokenVerification, adminAuthorization, reviewController.adminRemoveReview);

// --- Public routes ---

// Search/browse reviews using query filters
router.get('/', reviewController.searchReviews);

module.exports = router;