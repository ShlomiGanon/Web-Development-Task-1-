const express = require('express');
const router = express.Router();

// Importing the different route modules
const userRoutes = require('./user_routes');
const profileRoutes = require('./profile_routes');
const contentRoutes = require('./content_routes');

// Defining the base paths for each group of routes
router.use('/user', userRoutes);
router.use('/profile', profileRoutes);
router.use('/content', contentRoutes);

module.exports = router;