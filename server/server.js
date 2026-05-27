/* eslint-disable no-unused-vars */
const express = require('express');
const { User, UserProfile, Media } = require('./entities.js');
const app = express();
app.use(express.json());
app.use(express.static('../'));

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';


//-------------- ROUTES --------------
/**
 * @route GET /
 * @description Welcome message
 * @returns {Object} 200 - Welcome message
 */
app.get('/', (req, res) => 
    {
        res.send('Hello');
    }
);


/**
 * @route GET /users
 * @description Get all users
 * @returns {Object} 200 - List of users
 */
app.get('/users', (req, res) => 
{
    //TODO: Implement this route
    res.status(501).json({ success: false, message: 'Not implemented' });
});


/**
 * @route POST /register
 * @description Register a new user
 * @param {Object} req.body - User information
 * @param {string} req.body.email - User email
 * @param {string} req.body.phone - User phone
 * @param {string} req.body.full_name - User full name
 * @param {string} req.body.password - User password
 * @returns {Object} 201 - User registered successfully
 * @returns {Object} 400 - Missing required fields
 */
app.post('/register', (req, res) => 
{
    const required = ['email', 'phone', 'full_name', 'password'];
    const missing = required.filter(field => !req.body[field]);

    if (missing.length > 0) 
    {
        return res.status(400).json(
        { 
            success: false, 
            message: 'Missing required fields: ' + missing.join(', ') 
        });
    }

    //TODO: Implement this route
    res.status(501).json({ success: false, message: 'Not implemented' });
});


//-------------- SERVER --------------
app.listen(port, () => 
{
    console.log(`Server is running on http://${host}:${port}`);
});

