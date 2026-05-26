const express = require('express');
const { User, UserProfile, Media } = require('./models.js');
const app = express();
app.use(express.json());
app.use(express.static('../'));

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
let users = [];//users list
let media = [];//media list
let connections = {};//session token to user info

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
    res.json(users);
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
    if (!req.body.email || !req.body.phone || !req.body.full_name || !req.body.password) 
    {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const email = req.body.email;
    const phone = req.body.phone;
    const full_name = req.body.full_name;
    const password = req.body.password;
    const profiles = [];
    const profile = new UserProfile(1, full_name.split(' ')[0], 'profile1.png');
    profiles.push(profile);
    const user = new User(email, phone, full_name, profiles, password);
    users.push(user);
    users_to_profiles[email] = profiles;
    console.log("user registered successfully with email: " + email);
    res.status(201).json({ success: true, message: 'User registered successfully' });
});


//-------------- SERVER --------------
app.listen(port, () => 
{
    console.log(`Server is running on http://${host}:${port}`);
});

