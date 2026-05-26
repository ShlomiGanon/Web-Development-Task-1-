const express = require('express');
const { User, UserProfile, Media } = require('./models.js');
const app = express();
app.use(express.json());
app.use(express.static('../'));

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
let users = [];//users list
let users_to_profiles = {};//user email to profiles
let media = [];//media list
let connections = {};//session token to user info

app.get('/', (req, res) => 
    {
        res.send('Hello');
    }
);

//i want you to add a new route that will return all users from local storage
app.get('/users', (req, res) => 
{
    res.json(users);
});

//i want you to add a new route that will register a new user
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

app.listen(port, () => 
{
    console.log(`Server is running on http://${host}:${port}`);
});

