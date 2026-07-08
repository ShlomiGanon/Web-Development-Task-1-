const mongoose = require("mongoose");

const DEFAULT_AGE = 0;
const MIN_AGE = 0;
const MAX_AGE = 100;
const DEFAULT_IMAGE_NAME = "UNDEFINED_PROFILE.png";

const profileSchema = new mongoose.Schema(
{
    profileName:
    {
        type: String,
        required: true,
        trim: true
    },

    age://to be able to block profile from watching movies under their age
    {
        type: Number,
        default: DEFAULT_AGE,
        min: MIN_AGE,
        max: MAX_AGE
    },

    ImageName:
    {
        type: String,
        default: DEFAULT_IMAGE_NAME,
        required: true,
        trim: true
    },

    LastWatched_Content_IDs:
    {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
    },

    Liked_Content_IDs:
    {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },

    User_ID:
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
        required: true
    }
},
{
    timestamps: true
});
profileSchema.statics.DefaultProfile = function(user_id, profileName = "New Profile")
{
    const objectId = new mongoose.Types.ObjectId(user_id);

    return new this({
        profileName: profileName,
        age: DEFAULT_AGE,
        ImageName: DEFAULT_IMAGE_NAME,
        User_ID: objectId
    });
};

module.exports = mongoose.model("Profile", profileSchema);