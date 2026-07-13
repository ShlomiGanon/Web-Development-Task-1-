const mongoose = require("mongoose");
 
const DEFAULT_AGE = 0;
const MIN_AGE = 0;
const MAX_AGE = 100;
const DEFAULT_IMAGE_NAME = "UNDEFINED_PROFILE.png";
 
/**
 * Profile Schema
 * Represents a viewing profile belonging to a User account.
 */
const profileSchema = new mongoose.Schema(
{
    // Display name of the profile
    profile_name: 
    { 
        type: String, 
        required: true, 
        trim: true 
    },
 
    // Age used to restrict content by age_limit
    age: 
    { 
        type: Number, 
        default: DEFAULT_AGE, 
        min: MIN_AGE, 
        max: MAX_AGE 
    },
 
    // Filename of the profile image
    image_name: 
    { 
        type: String, 
        default: DEFAULT_IMAGE_NAME, 
        required: true, 
        trim: true 
    },
 
    // Episodes most recently watched by this profile, oldest to newest
    last_watched: 
    { 
        type: 
        [
            {
                // Episode that was watched
                episode_id: 
                { 
                    type: mongoose.Schema.Types.ObjectId, 
                    ref: "Episode" 
                },
 
                // Parent content of the episode, denormalized to skip an extra populate
                content_id: 
                { 
                    type: mongoose.Schema.Types.ObjectId, 
                    ref: "Content" 
                }
            }
        ], 
        default: [] 
    },
 
    // Content liked by this profile
    liked_content_ids: 
    { 
        type: [mongoose.Schema.Types.ObjectId], 
        ref: "Content", 
        default: [] 
    },
 
    // Reference to the owning User account
    user_id: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true, 
        index: true 
    }
},
{
    timestamps: true
});
 
/**
 * Builds an unsaved Profile document with default values for a new user.
 */
profileSchema.statics.defaultProfile = function(userId, profileName = "New Profile")
{
    return new this({
        profile_name: profileName,
        age: DEFAULT_AGE,
        image_name: DEFAULT_IMAGE_NAME,
        user_id: new mongoose.Types.ObjectId(userId)
    });
};