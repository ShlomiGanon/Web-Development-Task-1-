const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile_controller');
const { tokenVerification } = require('../middlewares/token_manager');
const { authorizeProfileAccess } = require('../middlewares/profile_authorization');
const { contentAuthorization } = require('../middlewares/content_authorization');
const suggestionsController = require('../controllers/suggestions_controller.js');

// Apply token authentication to all routes defined in this file
router.use(tokenVerification);

// Route to create a new profile for the authenticated user
router.post('/', profileController.createProfile);

// Route to update all profiles for the authenticated user
router.put('/', profileController.updateAllProfiles);

// Route to get all profiles for the authenticated user
router.get('/', profileController.getProfile);

// Route to delete a specific profile
router.delete('/:profileId', authorizeProfileAccess, profileController.deleteProfile);

// Route to update profile details
router.put('/:profileId', authorizeProfileAccess, profileController.updateProfile);

// Route to get a specific profile
router.get('/:profileId', authorizeProfileAccess, profileController.getProfile);

// Route to get the details of a specific profile
router.get('/:profileId/details', authorizeProfileAccess, profileController.getProfileDetails);

// Route to add or remove a like from a media item
router.post('/:profileId/likes/:contentId', authorizeProfileAccess, contentAuthorization, profileController.pressLike);

// Route to update the last watched media for a specific profile (defaults to
// resume-or-S1E1 when no episode is specified)
router.post('/:profileId/watch/:contentId', authorizeProfileAccess, contentAuthorization, profileController.watchMedia);

// Same, but with an explicit episode to watch
router.post('/:profileId/watch/:contentId/:episodeId', authorizeProfileAccess, contentAuthorization, profileController.watchMedia);

// Route to get other profiles activity for a specific profile
router.get('/:profileId/other_profiles_recommendations', authorizeProfileAccess, suggestionsController.getContentOthersEngagedWith);

module.exports = router;