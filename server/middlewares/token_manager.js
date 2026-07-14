const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
class TokenManager
{
    constructor(save_directory = path.join(__dirname, '../data/'))
    {
        this.token_2_user_id = {};//token -> user_id
        this.user_id_2_tokens = {};//user_id -> [token1, token2, ...]
        this.banned_users = {};//user_id -> banned_until
        this.save_directory = save_directory;
        this.load();
    }

    addUserToken(user_id)
    {
        const token = this._generateToken();
        this.token_2_user_id[token] = user_id;
        if (this.user_id_2_tokens[user_id] === undefined)
        {
            this.user_id_2_tokens[user_id] = {};
        }
        this.user_id_2_tokens[user_id][token] = true;
        this.save();
        return token;
    }

    removeUserToken(token)
    {
        const user_id = this.token_2_user_id[token];
        if (user_id !== undefined)
        {
            if (this.user_id_2_tokens[user_id])
            {
                delete this.user_id_2_tokens[user_id][token];
            }
            delete this.token_2_user_id[token];
        }
        this.save();
    }

    deleteAllTokensOfUser(user_id)
    {
        if (this.user_id_2_tokens[user_id])
        {
            Object.keys(this.user_id_2_tokens[user_id]).forEach(token => {
                delete this.token_2_user_id[token];
            });
            delete this.user_id_2_tokens[user_id];
        }
        this.save();
    }

    deleteAllTokens()
    {
        this.token_2_user_id = {};
        this.user_id_2_tokens = {};
        this.save();
    }

    getUserIdByToken(token)
    {
        return this.token_2_user_id[token];
    }

    _generateToken()
    {
        let token = crypto.randomBytes(32).toString('hex');
        while (this.token_2_user_id[token] !== undefined)
        {
            token = crypto.randomBytes(32).toString('hex');
        }
        return token;
    }

    load(directory_path = null)
    {
        if(directory_path === null)directory_path = this.save_directory;
        try
        {
            const data = fs.readFileSync(path.join(directory_path, 'token_manager.json'), 'utf8');
            if(!data)return;//if the file is empty, return , we don't need to load anything
            const parsed_data = JSON.parse(data);
            if(!parsed_data.token_2_user_id || !parsed_data.user_id_2_tokens || !parsed_data.banned_users)return;//if the data is not valid, return , we don't need to load anything
            this.token_2_user_id = parsed_data.token_2_user_id;
            this.user_id_2_tokens = parsed_data.user_id_2_tokens;
            this.banned_users = {};
            Object.entries(parsed_data.banned_users).forEach(([key, value]) => 
            {
                this.banned_users[key] = new Date(value);
            });
        }
        catch (error)
        {
            console.error('Error loading token manager: ', error);
        }
    }

    save(directory_path = null)
    {
        if(directory_path === null)directory_path = this.save_directory;
        try
        {
            fs.mkdirSync(directory_path, { recursive: true });
            fs.writeFileSync(path.join(directory_path, 'token_manager.json'), 
            JSON.stringify({ 
                token_2_user_id: this.token_2_user_id, 
                user_id_2_tokens: this.user_id_2_tokens, 
                banned_users: this.banned_users }));
        }
        catch (error)
        {
            console.error('Error saving token manager: ', error);
        }
    }

    IsHaveTokens(user_id)
    {
        return this.user_id_2_tokens[user_id] !== undefined && Object.keys(this.user_id_2_tokens[user_id]).length > 0;
    }

    IsBanned(user_id)
    {
        if(this.banned_users[user_id] !== undefined)
        {
            if(this.banned_users[user_id] > Date.now())return true;
            else
            {
                delete this.banned_users[user_id];
                //i dont want to save , slow action to write to the file every time
                return false;
            }
        }
        return false;
    }

    BanUser(user_id , hours_to_ban)
    {

        this.banned_users[user_id] = Date.now() + hours_to_ban * 60 * 60 * 1000;
        this.save();
    }

    UnbanUser(user_id)
    {
        delete this.banned_users[user_id];
        this.save();
    }
}

const tokenManagerInstance = new TokenManager();

const tokenVerification = (req, res, next) =>
{
    // Expected header: "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token)
    {
        return res.json({ success: false, message: "Token missing or invalid" });
    }

    // Use the single instance to verify the token
    const userId = tokenManagerInstance.getUserIdByToken(token);
    
    if (userId === undefined)
    {
        return res.json({ success: false, message: "Session expired or invalid token" });
    }

    // Attach user info to request object
    req.target_user_id = userId;
    delete req.headers['authorization']; // remove the token so downstream middleware/controllers can't see it
    next();
}

const removeTokenRequest = (req, res) =>
{
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token)
    {
        return res.json({ success: false, message: "Token missing or invalid" });
    }
    if (tokenManagerInstance.getUserIdByToken(token) === undefined)
    {
        return res.json({ success: false, message: "Token invalid" });
    }
    tokenManagerInstance.removeUserToken(token);
    return res.json({ success: true, message: "Token removed successfully" });
}

const CheckTokensCountRequest = (req, res) =>
{
    const user_id = req.target_user_id;
    if (user_id === undefined)return res.json({ success: false, message: "user_id is missing in the request" });
        
    const tokensObject = tokenManagerInstance.user_id_2_tokens[user_id];
    const tokens_count = tokensObject ? Object.keys(tokensObject).length : 0;
    return res.json({ success: true, tokens_count: tokens_count });
}

const KickUserRequest = (req, res) =>
{
    const user_id = req.target_user_id;
    if (user_id === undefined)return res.json({ success: false, message: "user_id is missing in the request" });
    if (!tokenManagerInstance.IsHaveTokens(user_id))
    {
        return res.json({ success: false, message: "User is not logged in" });
    }
    tokenManagerInstance.deleteAllTokensOfUser(user_id);
    return res.json({ success: true });
}

const IsBannedRequest = (req, res) =>
{
    const user_id = req.target_user_id;
    if (user_id === undefined)return res.json({ success: false, message: "user_id is missing in the request" });
    const is_banned = tokenManagerInstance.IsBanned(user_id);
    return res.json({ success: true, is_banned: is_banned });
}

const BanUserRequest = (req, res) =>
{
    const user_id = req.target_user_id;
    if (user_id === undefined)return res.json({ success: false, message: "user_id is missing in the request" });
    const hours_to_ban = parseInt(req.body.hours_to_ban);
    if (isNaN(hours_to_ban))return res.json({ success: false, message: "hours_to_ban is not a number" });
    tokenManagerInstance.BanUser(user_id, hours_to_ban);
    return res.json({ success: true });
}

module.exports = { tokenManagerInstance, tokenVerification, removeTokenRequest, KickUserRequest, CheckTokensCountRequest, IsBannedRequest, BanUserRequest };