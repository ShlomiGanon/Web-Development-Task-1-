const User = require('../models/user');
const { tokenManagerInstance } = require('../middlewares/token_manager');
const { Is_Valid_Name, Is_Valid_Email, Is_Valid_Phone, Is_Valid_Password, get_age_from_birthday, Hash_Password, Compare_Password } = require('../scripts/auth');
const my_logger = require('../scripts/my_logger');
const { ENABLE_18_AGE_LIMIT } = require('../scripts/constants');
const {permissionManagerInstance } = require('../middlewares/permission_manager');
const safe_user = (user , user_permission_level = null) =>
{
    if(user_permission_level === null)user_permission_level = permissionManagerInstance.getPermissionLevel(user._id);
    return {
        id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        birthday: user.birthDate.toISOString(),
        createdAt: user.createdAt.toISOString(),
        permission_level: user_permission_level
    };
}



/**
 * Register a new user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { email: string, phone: string, password: string, fullName: string, birthday: string }
//res.json: { success: boolean, message: string }
const register = async (req, res) => 
{
    try 
    {
        const { email, phone, password, fullName, birthday } = req.body;
        const firstName = fullName.split(' ')[0];
        const lastName = fullName.split(' ')[1];
        if(!firstName || !lastName)return res.json({ success: false, message: 'Invalid full name' });
        if(!Is_Valid_Name(firstName))return res.json({ success: false, message: 'Invalid first name' });
        if(!Is_Valid_Name(lastName))return res.json({ success: false, message: 'Invalid last name' });
        if(!Is_Valid_Email(email))return res.json({ success: false, message: 'Invalid email' });
        if(!Is_Valid_Phone(phone))return res.json({ success: false, message: 'Invalid phone number' });
        if(!Is_Valid_Password(password))return res.json({ success: false, message: 'Invalid password' });
        const birthdayDate = new Date(birthday);
        if(ENABLE_18_AGE_LIMIT)
        {
            const age = get_age_from_birthday(birthdayDate);
            if(age < 18)return res.json({ success: false, message: 'User must be at least 18 years old' });
        }
        const hashedPassword = await Hash_Password(password);
        
        //check if the email or phone already exists
        if(await User.findOne({ email }))return res.json({ success: false, message: 'Email already exists' });
        if(await User.findOne({ phone }))return res.json({ success: false, message: 'Phone number already exists' });

        const user = await User.AddDefaultUser(email, hashedPassword, fullName, phone, birthdayDate);
        if(!user)return res.json({ success: false, message: 'Failed to register user' });
        res.json({ success: true, message: 'User registered successfully' });
        my_logger.ConsoleLog(`User registered successfully.`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('register', `User registered successfully.`, { "user": user.toJSON() }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error registering user: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('register', 'Error registering user.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}

/**
 * Login a user by email or phone and password
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { email_or_phone: string, password: string }
//res.json: { success: boolean, message: string, token: string }
const login = async (req, res) => 
{
    try
    {
        const { email_or_phone, password } = req.body;
        let user = null;
        if(Is_Valid_Email(email_or_phone))user = await User.findOne({ email: email_or_phone });
        else if(Is_Valid_Phone(email_or_phone))user = await User.findOne({ phone: email_or_phone });
        else return res.json({ success: false, message: 'Invalid email or phone' });
        if(!user)return res.json({ success: false, message: 'User not found' });
        const isPasswordCorrect = await Compare_Password(password, user.password);
        if(!isPasswordCorrect)
        {
            my_logger.OperationLog('login', 'Invalid password.', {input_password: password} , my_logger.Log_Level.WARNING);
            return res.json({ success: false, message: 'Invalid password' });
        }
        const token = tokenManagerInstance.addUserToken(user._id.toString());
        res.json({ success: true, message: 'Login successful', "token": token });
        my_logger.ConsoleLog(`User logged in successfully for email: ${user.email}.`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('login', 'User logged in successfully.', { "user": safe_user(user), "token": token }, my_logger.Log_Level.INFO);
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error logging in: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('login', 'Error logging in.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}


/**
 * Get the current user's profile information
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { user: Object }
//res.json: { success: boolean, message: string, user: { id: string, email: string, phone: string, fullName: string, birthday: string } }
const getUser = async (req, res) => 
{
    try
    {
        const user_id = req.target_user_id;
        const user = await User.findById(user_id);
        if(!user)
        {
            return res.json({ success: false, message: 'User not found' });
        }
        my_logger.ConsoleLog(`getUser [user_id: ${user_id}] successful.`, my_logger.Log_Level.INFO);
        const logUser = safe_user(user);
        my_logger.OperationLog('getUser', `User found.`, { "user": logUser }, my_logger.Log_Level.INFO);
        res.json({ success: true, message: 'User found', user: logUser });
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error getting user: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getUser', 'Error getting user.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
}


/**
 * Update the current user's profile information
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//req.body: { user_id: String, data: Object }
//data: { email: String, phone: String, fullName: String, birthday: String }
//res.json: { success: boolean, message: string, user: { id: string, email: string, phone: string, fullName: string, birthday: string } }
const updateUser = async (req, res) =>
{
    try
    {
        const user_id = req.target_user_id;
        const current_user = await User.findById(user_id);
        const current_safe_user = safe_user(current_user);
        if (!current_user)
        {
            return res.json({ success: false, message: 'User not found' , "user": undefined });
        }

        const changes = {};
        const old_data = {};

        if(req.body.password)
        {
            if(!Is_Valid_Password(req.body.password))return res.json({ success: false, message: 'Invalid password' , "user": current_safe_user });
            changes.password = await Hash_Password(req.body.password);
            old_data.password = current_user.password;
        }

        if (req.body.email && req.body.email !== current_user.email)
        {
            if (!Is_Valid_Email(req.body.email))
            {
                return res.json({ success: false, message: 'Invalid email' , "user": current_safe_user });
            }

            changes.email = req.body.email;
            old_data.email = current_user.email;
        }

        if (req.body.phone && req.body.phone !== current_user.phone)
        {
            if (!Is_Valid_Phone(req.body.phone))
            {
                return res.json({ success: false, message: 'Invalid phone number' , "user": current_safe_user });
            }

            changes.phone = req.body.phone;
            old_data.phone = current_user.phone;
        }

        if (req.body.fullName && req.body.fullName !== current_user.fullName)
        {
            const firstName = req.body.fullName.split(' ')[0];
            const lastName = req.body.fullName.split(' ')[1];
            if(!firstName || !lastName)return res.json({ success: false, message: 'Invalid full name' , "user": current_safe_user });
            if(!Is_Valid_Name(firstName))return res.json({ success: false, message: 'Invalid first name' , "user": current_safe_user });
            if(!Is_Valid_Name(lastName))return res.json({ success: false, message: 'Invalid last name' , "user": current_safe_user });
            changes.fullName = req.body.fullName;
            old_data.fullName = current_user.fullName;
        }

        if (req.body.birthday && req.body.birthday !== current_user.birthDate)
        {
            const birthdayDate = new Date(req.body.birthday);
            if(birthdayDate > new Date())return res.json({ success: false, message: 'Invalid birthday' , "user": current_safe_user });   
            if(ENABLE_18_AGE_LIMIT)
            {
                const age = get_age_from_birthday(birthdayDate);
                if(age < 18)return res.json({ success: false, message: 'User must be at least 18 years old' , "user": current_safe_user });
            }
            changes.birthDate = birthdayDate;
            old_data.birthDate = current_user.birthDate;
        }

        if (Object.keys(changes).length === 0)
        {
            return res.json({ success: false, message: 'No changes to update' , "user": current_safe_user });
        }

        let user;

        try
        {
            // Inner try/catch specifically to translate MongoDB's duplicate key error (11000)
            // into a clear message, instead of falling through to the generic error handler below
            user = await User.findByIdAndUpdate(user_id, changes, { new: true, runValidators: true });
        }
        catch (dbError)
        {
            if (dbError.code === 11000)
            {
                const duplicatedField = Object.keys(dbError.keyPattern)[0];
                const fieldLabel = duplicatedField === 'email' ? 'Email' : 'Phone number';
                return res.json({ success: false, message: `${fieldLabel} already exists` , "user": current_safe_user });
            }

            throw dbError;
        }

        if (!user)
        {
            my_logger.ConsoleLog(`Failed to update user! [request_uid: ${user_id}]`, my_logger.Log_Level.ERROR);
            my_logger.OperationLog('updateUser', 'Failed to update user! Please try again later.', { "request_uid": user_id, "update_result": user }, my_logger.Log_Level.ERROR);
            return res.json({ success: false, message: 'Failed to update user! Please try again later.' , "user": current_safe_user });
        }

        my_logger.ConsoleLog(`User updated successfully.`, my_logger.Log_Level.INFO);
        const logUser = safe_user(user);
        my_logger.OperationLog('updateUser', `User updated successfully.`, { "old_data": old_data, "changes": changes, "user": logUser }, my_logger.Log_Level.INFO);

        res.json({ success: true, message: 'User updated successfully', user: logUser });
    }
    catch (error)
    {
        my_logger.ConsoleLog(`Error updating user: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('updateUser', 'Error updating user.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' , "user": undefined });
    }
}




module.exports = { register, login, getUser, updateUser , safe_user};
