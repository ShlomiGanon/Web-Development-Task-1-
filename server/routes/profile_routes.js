const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile_controller');
const { tokenVerification } = require('../middlewares/token_manager');
const { authorizeProfileAccess } = require('../middlewares/profile_authorization');
const { mediaAuthorization } = require('../middlewares/media_authorization');

// Apply token authentication to all routes defined in this file
router.use(tokenVerification);

// Route to create a new profile for the authenticated user
router.post('/create', profileController.createProfile);

// Route to delete a specific profile
router.delete('/delete/:profileId', authorizeProfileAccess, profileController.deleteProfile);

// Route to update profile details
router.put('/update/:profileId', authorizeProfileAccess, profileController.updateProfile);

// Route to update all profiles for the authenticated user
router.put('/update_all', profileController.updateAllProfiles);

// Route to get a specific profile or list all profiles for the user
router.get('/get/:profileId?', profileController.getProfile);

// Route to get the details of a specific profile
router.get('/get_details/:profileId', authorizeProfileAccess, profileController.getProfileDetails);

// Route to add or remove a like from a media item
router.post('/press_like/:profileId/:mediaId', authorizeProfileAccess , mediaAuthorization , profileController.pressLike);

// Route to update the last watched media for a specific profile
router.post('/watch/:profileId/:mediaId', authorizeProfileAccess , mediaAuthorization , profileController.watchMedia);


module.exports = router;