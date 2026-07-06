const crypto = require('crypto');

class TokenManager
{
    constructor()
    {
        this.token_2_user_id = {}; 
        this.user_id_2_tokens = {};
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
    }

    deleteAllTokens()
    {
        this.token_2_user_id = {};
        this.user_id_2_tokens = {};
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

module.exports = { tokenManagerInstance, tokenVerification, removeTokenRequest };