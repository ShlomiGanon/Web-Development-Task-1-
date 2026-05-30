const crypto = require('crypto');
class SessionManager 
{
    /**
     * Initializes the SessionManager class.
     */

    constructor()
    {
        this.token_2_user_id = {};//key: Token, value: UserID
        this.user_id_2_tokens = {};//key: UserID, value: [Token1, Token2, ...]
    }

    /**
     * Adds a session for a user.
     * @param {string} user_id - The user ID to add the session for.
     * @returns {string} The token for the new session.
     */
    addSession(user_id)
    {
        const token = this._generateToken();
        this.token_2_user_id[token] = user_id;
        if (!this.user_id_2_tokens[user_id])
        {
            //if the user_id is not in the user_id_2_tokens, add it
            this.user_id_2_tokens[user_id] = {};
        }
        this.user_id_2_tokens[user_id][token] = true;
        return token;
    }

    /**
     * Removes a session by token.
     * @param {string} token - The token to remove.
     */
    removeSession(token)
    {
        const user_id = this.token_2_user_id[token];
        if (user_id) 
        {
            if (this.user_id_2_tokens[user_id])
            {
                delete this.user_id_2_tokens[user_id][token];
            }
            delete this.token_2_user_id[token];
        }
    }

    /**
     * Gets the user ID by token.
     * @param {string} token - The token to get the user ID for.
     * @returns {string|undefined} The user ID or undefined if the token is not found.
     */
    getUserIdByToken(token)
    {
        return this.token_2_user_id[token] || undefined;
    }

    /**
     * Generates a new token.
     * @returns {string} The new token.
     */
    _generateToken()
    {
        let token = crypto.randomBytes(32).toString('hex');
        while (this.token_2_user_id[token])
        {
            token = crypto.randomBytes(32).toString('hex');
        }
        return token;
    }
}

module.exports = { SessionManager };
