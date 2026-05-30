/* eslint-disable no-unused-vars */
const express = require('express');
const { User, UserProfile, Media } = require('./entities.js');
const { MemoryStorage } = require('./storage/memory-storage.js');
const app = express();
const path = require('path');

const storage = new MemoryStorage();

app.use(express.json());
//--- Static routes ---
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/html', express.static(path.join(__dirname, '../html')));
//--- HTML routes ---
app.get('/', (req, res) =>
{
    res.sendFile(path.join(__dirname, '../index.html'));
});
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';


//-------------- ROUTES --------------
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
    const first_name = req.body.full_name.split(' ')[0];
    const last_name = req.body.full_name.split(' ')[1];
    if (!first_name || !last_name)
    {
        return res.status(400).json(
        { 
            success: false, 
            message: 'Full name must contain both first and last name' 
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

