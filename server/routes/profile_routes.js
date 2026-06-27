const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile_controller');
const { tokenVerification } = require('../middlewares/token_manager');

// Apply token authentication to all routes defined in this file
router.use(tokenVerification);

// Route to create a new profile for the authenticated user
router.post('/create', profileController.createProfile);

// Route to delete a specific profile
router.delete('/delete', profileController.deleteProfile);

// Route to update profile details
router.put('/update', profileController.updateProfile);

// Route to get a specific profile or list all profiles for the user
router.get('/get', profileController.getProfile);

// Route to add or remove a like from a media item
router.post('/press_like', profileController.pressLike);

// Route to update the last watched media for a specific profile
router.post('/watch', profileController.watchMedia);

module.exports = router;