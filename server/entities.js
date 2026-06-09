const constants = require('./constants.js');

/**
 * A class to store the user information.
 * @param {string} id - The unique identifier of the user.
 * @param {string} email - The email of the user.
 * @param {string} phone - The phone number of the user.
 * @param {string} fullName - The full name of the user.
 * @param {Array<UserProfile>} profiles - The profiles of the user.
 * @param {string} password - The password of the user.
 */
class User 
{
    constructor(id, email, phone, fullName, profiles, password) 
    {
        this.id = id;
        this.email = email;
        this.phone = phone;
        this.fullName = fullName;
        this.profiles = (profiles || []).map(p => p instanceof UserProfile ? p.clone() : UserProfile.fromJSON(p));
        this.password = password;
    }
    
    /**
     * Clones the User instance by creating a new User instance with the same properties.
     * @returns {User} The cloned User instance.
     */
    clone()
    {
        return new User(this.id, this.email, this.phone, this.fullName, this.profiles, this.password);
    }

    /**
     * Static method to create a User instance from a raw JSON object.
     * @param {Object} rawObject - The raw JSON object to create a User instance from.
     * @returns {User} The User instance created from the raw JSON object.
     */
    static fromJSON(rawObject) 
    {
        if (!rawObject) return null;
        if (rawObject instanceof User) throw new Error("Invalid JSON: this is already a User instance");
        return new User(
            rawObject.id,
            rawObject.email, 
            rawObject.phone, 
            rawObject.fullName, 
            rawObject.profiles, 
            rawObject.password 
        );
    }

    /**
     * Converts the User instance to a JSON object.
     * @returns {Object} The JSON object representing the User instance.
     */
    toJSON() 
    {
        return {
            id: this.id,
            email: this.email,
            phone: this.phone,
            fullName: this.fullName,
            profiles: this.profiles.map(p => p.toJSON()),
            password: this.password
        };
    }

    /**
     * Converts the User instance to a JSON object without the password (for public use).
     * @returns {Object} The JSON object representing the User instance without the password.
     */
    toPublicJSON() 
    {
        const data = this.toJSON();
        delete data.password;//remove the password from the JSON object
        return data;//return the JSON object without the password
    }
}


class UserProfile 
{
    /**
     * Initializes a UserProfile instance with the given parameters.
     * 
     * @param {string} id - The unique identifier of the user profile.
     * @param {string} name - The name of the user profile.
     * @param {string} [imageName="profile1.png"] - The name of the image file for the user profile.
     * @param {Array<string>} [LastWatched_Media_IDs = []] - The array of media item IDs last watched by the user profile.
     * @param {Set<string>} [wasLiked_Media_IDs = new Set()] - The collection of media item IDs liked by the user profile. Will be stored internally as a Set.
     */
    constructor(id, name, imageName = null, LastWatched_Media_IDs = [], wasLiked_Media_IDs = new Set()) 
    {
        this.id = id;
        this.name = name;
        
        this.imageName = imageName ? imageName : "UNDEFINED_PROFILE.png";
        
        const rawWatchIDs = Array.isArray(LastWatched_Media_IDs) ? LastWatched_Media_IDs : [];
        this.LastWatched_Media_IDs = rawWatchIDs.slice(0, constants.MAX_LAST_WATCHED_MEDIA_LIMIT);
        
        if (wasLiked_Media_IDs instanceof Set) 
        {
            this.wasLiked_Media_IDs = new Set(wasLiked_Media_IDs);
        } 
        else
        {
            const rawLikeIDs = Array.isArray(wasLiked_Media_IDs) ? wasLiked_Media_IDs : [];
            this.wasLiked_Media_IDs = new Set(rawLikeIDs);
        }
    }

    /**
     * Clones the UserProfile instance by creating a new UserProfile instance with the same properties.
     * @returns {UserProfile} The cloned UserProfile instance.
     */
    clone()
    {
        return new UserProfile(this.id, this.name, this.imageName, this.LastWatched_Media_IDs, this.wasLiked_Media_IDs);
    }


    /**
     * Static method to create a Profile instance from a raw JSON object.
     * @param {Object} rawObject - The raw JSON object to create a Profile instance from.
     * @returns {Profile} The Profile instance created from the raw JSON object.
     */
    static fromJSON(rawObject) 
    {
        if (!rawObject) return null;
        if (rawObject instanceof UserProfile) throw new Error("Invalid JSON: this is already a UserProfile instance");
        return new UserProfile(
            rawObject.id,
            rawObject.name,
            rawObject.imageName,
            rawObject.LastWatched_Media_IDs,
            rawObject.wasLiked_Media_IDs
        );
    }

    toJSON() 
    {
        return {
            id: this.id,
            name: this.name,
            imageName: this.imageName,
            LastWatched_Media_IDs: this.LastWatched_Media_IDs,
            wasLiked_Media_IDs: Array.from(this.wasLiked_Media_IDs)
        };
    }
}

/**
 * A class to store the media information.
 * @param {string} id - The unique identifier of the media.
 * @param {string} name - The name of the media.
 * @param {string} [cover_imageName="media1.png"] - The name of the image file for the media.
 * @param {number} [likes=0] - The number of likes the media has.
 */
class Media 
{
    constructor(id, name, cover_imageName = null, likes = 0)
    {
        this.id = id;
        this.name = name;
        this.cover_imageName = cover_imageName ? cover_imageName : "UNDEFINED.png";
        this.likes = likes;
    }
    clone()
    {
        return new Media(this.id, this.name, this.cover_imageName, this.likes);
    }

    static fromJSON(rawObject) 
    {
        if (!rawObject) return null;
        if (rawObject instanceof Media) throw new Error("Invalid JSON: this is already a Media instance");
        return new Media(rawObject.id, rawObject.name, rawObject.cover_imageName, rawObject.likes);
    }

    toJSON() 
    {
        return {
            id: this.id,
            name: this.name,
            cover_imageName: this.cover_imageName,
            likes: this.likes
        };
    }
}

module.exports = { User, UserProfile, Media };