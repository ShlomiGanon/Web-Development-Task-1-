const mongoose = require("mongoose");
const Profile = require("./profile");
const { MAX_PROFILES_LIMIT } = require('../scripts/constants');

/**
 * User Schema
 * Represents an account that owns one or more Profiles.
 */
const userSchema = new mongoose.Schema(
{
    // Account email, used for login
    email: 
    { 
        type: String, 
        required: true, 
        index: true, 
        unique: true, 
        lowercase: true, 
        trim: true 
    },

    // Hashed account password
    password: 
    { 
        type: String, 
        required: true 
    },

    // Full name of the account holder
    full_name: 
    { 
        type: String, 
        required: true, 
        trim: true 
    },

    // Contact phone number
    phone: 
    { 
        type: String, 
        required: true, 
        index: true, 
        unique: true, 
        trim: true 
    },

    // Date of birth
    birth_date: 
    { 
        type: Date, 
        required: true, 
        index: true 
    },

    // Profiles belonging to this account
    profile_ids: 
    { 
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }], 
        default: [] 
    }
},
{
    timestamps: true
});

// Index on createdAt for joined_after/joined_before filtering
userSchema.index({ createdAt: 1 });

/**
 * Returns the full Profile documents associated with this user.
 */
userSchema.methods.getProfilesCollection = async function()
{
    return await this.model("Profile").find({ _id: { $in: this.profile_ids } });
};

/**
 * Creates a new User together with a default Profile.
 * Not wrapped in a transaction, so a failed user save after a successful
 * profile save can leave an orphaned profile.
 */
userSchema.statics.addDefaultUser = async function(email, password, fullName, phone, birthDate)
{
    const User = this;

    const userId = new mongoose.Types.ObjectId();
    const user = new User(
    {
        _id: userId,
        email,
        password,
        full_name: fullName,
        phone,
        birth_date: birthDate,
        profile_ids: []
    });

    const defaultProfile = await Profile.defaultProfile(userId);
    await defaultProfile.save();

    user.profile_ids.push(defaultProfile._id);
    await user.save();

    return user;
};

/**
 * Creates a new profile for this user, up to MAX_PROFILES_LIMIT.
 */
userSchema.methods.addProfile = async function()
{
    const user = await this.model("User").findById(this._id);

    if (user.profile_ids.length >= MAX_PROFILES_LIMIT)
    {
        throw new Error(`Profile limit (${MAX_PROFILES_LIMIT}) reached`);
    }

    const newProfile = await Profile.defaultProfile(this._id);
    await newProfile.save();

    await this.model("User").updateOne(
        { _id: this._id },
        { $addToSet: { profile_ids: newProfile._id } }
    );

    return newProfile;
};

/**
 * Deletes a profile belonging to this user and removes it from profile_ids.
 * Refuses to remove the user's last remaining profile.
 */
userSchema.methods.removeProfile = async function(profileId)
{
    if (this.profile_ids.length === 1)
    {
        throw new Error("Cannot remove the last profile.");
    }

    const profileDeletion = await this.model("Profile").deleteOne(
    {
        _id: profileId,
        user_id: this._id
    });

    if (profileDeletion.deletedCount === 0)
    {
        throw new Error("Profile not found or access denied.");
    }

    const result = await this.model("User").updateOne(
    {
        _id: this._id,
        $expr: { $gt: [{ $size: "$profile_ids" }, 1] }
    },
    {
        $pull: { profile_ids: profileId }
    });

    if (result.modifiedCount === 0)
    {
        throw new Error("Cannot remove the last profile.");
    }

    return true;
};

// --- Search / filtering support ---

// Escapes regex special characters in a value
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Builds the regex pattern string for each string operator
const regexPatternBuilders = 
{
    regex_start:    (value) => `^${escapeRegex(value)}`,
    regex_end:      (value) => `${escapeRegex(value)}$`,
    regex_contains: (value) => `${escapeRegex(value)}`,
};

/**
 * Maps a query key to its target dbField, operator, and value type.
 */
userSchema.statics.searchFilterMap = 
{
    'born_after':  { dbField: 'birth_date', operator: '$gte', type: 'date' },
    'born_before': { dbField: 'birth_date', operator: '$lte', type: 'date' },

    'joined_after':  { dbField: 'createdAt', operator: '$gte', type: 'date' },
    'joined_before': { dbField: 'createdAt', operator: '$lte', type: 'date' },

    'email_starts':    { dbField: 'email', operator: 'regex_start',    type: 'string' },
    'email_ends':      { dbField: 'email', operator: 'regex_end',      type: 'string' },
    'email_contains':  { dbField: 'email', operator: 'regex_contains', type: 'string' },

    'phone_starts':    { dbField: 'phone', operator: 'regex_start',    type: 'string' },
    'phone_ends':      { dbField: 'phone', operator: 'regex_end',      type: 'string' },
    'phone_contains':  { dbField: 'phone', operator: 'regex_contains', type: 'string' },

    'fullname_starts':   { dbField: 'full_name', operator: 'regex_start',    type: 'string' },
    'fullname_ends':     { dbField: 'full_name', operator: 'regex_end',      type: 'string' },
    'fullname_contains': { dbField: 'full_name', operator: 'regex_contains', type: 'string' },
};

/**
 * Builds a MongoDB filter object from raw query params using searchFilterMap.
 * Unrecognized keys are ignored. Filters on the same dbField are merged.
 */
userSchema.statics.buildQuery = function(rawQuery)
{
    const dbFilter = {};
    const map = this.searchFilterMap;

    for (const [key, value] of Object.entries(rawQuery))
    {
        if (!map[key] || value === undefined || value === null || value === "") continue;

        const { dbField, operator, type } = map[key];

        if (type === 'date')
        {
            if (!dbFilter[dbField]) dbFilter[dbField] = {};
            dbFilter[dbField][operator] = new Date(value);
        }
        else if (type === 'string')
        {
            dbFilter[dbField] = { $regex: regexPatternBuilders[operator](value), $options: 'i' };
        }
    }

    return dbFilter;
};

module.exports = mongoose.model("User", userSchema);