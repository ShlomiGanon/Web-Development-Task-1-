const mongoose = require('mongoose');
const Profile = require('./profile');
const MAX_PROFILES_LIMIT = 4;

const userSchema = new mongoose.Schema({
    email: { type: String, required: true , index: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true, unique: true, trim: true },
    birthDate: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    profileIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }],
        default: []
    }
});

// Returns the full profile documents associated with the user
userSchema.methods.GetProfilesCollection = async function() {
    return await this.model('Profile').find({ _id: { $in: this.profileIds } });
};

/**
 * Static method to create a new user with a mandatory default profile.
 * Note: Without transactions, if profile creation succeeds but user save fails, 
 * an orphaned profile may exist.
 */
userSchema.statics.AddDefaultUser = async function(email, password, fullName, phone, birthDate) {
    try {
        const User = this;

        // 1. Create a new User instance
        const userId = new mongoose.Types.ObjectId();
        const user = new User({
            _id: userId,
            email,
            password,
            fullName,
            phone,
            birthDate,
            profileIds: [] 
        });

        // 2. Create and save the default profile
        let defaultProfile = await Profile.DefaultProfile(userId);
        await defaultProfile.save();

        // 3. Link the profile ID to the user and save
        user.profileIds.push(defaultProfile._id);
        await user.save();

        return user;
    } catch (error) {
        throw new Error("Failed to create user and default profile.", { cause: error });
    }
};

/**
 * Adds a new profile to the user.
 * Checks for profile limit before creation.
 */
userSchema.methods.addProfile = async function() 
{
    // eslint-disable-next-line no-useless-catch
    try 
    {
        // Refresh user to check current profile count
        const user = await this.model('User').findById(this._id);
        if (user.profileIds.length >= MAX_PROFILES_LIMIT) 
        {
            throw new Error(`Profile limit (${MAX_PROFILES_LIMIT}) reached`);
        }

        // Create new profile
        const newProfile = await Profile.DefaultProfile(this._id);

        await newProfile.save();

        await this.model('User').updateOne(
            { _id: this._id },
            { $addToSet: { profileIds: newProfile._id } }
        );

        return newProfile;
    }
    catch (error)
    {
        throw error;
    }
};

/**
 * Removes a profile ID.
 * Ensures the user cannot remove their last remaining profile.
 */
userSchema.methods.removeProfile = async function(profileId) {
    // eslint-disable-next-line no-useless-catch
    try {
        if (this.profileIds.length === 1)
        {
            throw new Error("Cannot remove the last profile.");
        }
        // 1. Attempt to delete the profile document
        const profileDeletion = await this.model('Profile').deleteOne({ 
            _id: profileId, 
            User_ID: this._id 
        });

        if (profileDeletion.deletedCount === 0) {
            throw new Error("Profile not found or access denied.");
        }

        // 2. Remove the profile ID from the user's array, ensuring at least one remains
        const result = await this.model('User').updateOne(
            { 
                _id: this._id,
                $expr: { $gt: [{ $size: "$profileIds" }, 1] } 
            },
            { $pull: { profileIds: profileId } }
        );

        if (result.modifiedCount === 0) {
            // Note: If profile was deleted but update failed, you might need manual cleanup
            throw new Error("Cannot remove the last profile.");
        }

        return true;
    } 
    catch
    (error)
    {
        throw error;
    }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const regexPatternBuilders = {
    regex_start:    (value) => `^${escapeRegex(value)}`,
    regex_end:      (value) => `${escapeRegex(value)}$`,
    regex_contains: (value) => `${escapeRegex(value)}`,
};

userSchema.statics.searchFilterMap = {
    // Date range filters
    'born_after':      { dbField: 'birthDate', operator: '$gte', type: 'date' },
    'born_before':     { dbField: 'birthDate', operator: '$lte', type: 'date' },
    'joined_after':    { dbField: 'createdAt', operator: '$gte', type: 'date' },
    'joined_before':   { dbField: 'createdAt', operator: '$lte', type: 'date' },

    // String filters — starts / ends / contains for each searchable field
    'email_starts':    { dbField: 'email',    operator: 'regex_start',    type: 'string' },
    'email_ends':      { dbField: 'email',    operator: 'regex_end',      type: 'string' },
    'email_contains':  { dbField: 'email',    operator: 'regex_contains', type: 'string' },

    'phone_starts':    { dbField: 'phone',    operator: 'regex_start',    type: 'string' },
    'phone_ends':      { dbField: 'phone',    operator: 'regex_end',      type: 'string' },
    'phone_contains':  { dbField: 'phone',    operator: 'regex_contains', type: 'string' },

    'fullname_starts':   { dbField: 'fullName', operator: 'regex_start',    type: 'string' },
    'fullname_ends':     { dbField: 'fullName', operator: 'regex_end',      type: 'string' },
    'fullname_contains': { dbField: 'fullName', operator: 'regex_contains', type: 'string' },
};

userSchema.statics.buildQuery = function(rawQuery) {
    const dbFilter = {};
    const map = this.searchFilterMap;

    for (const [key, value] of Object.entries(rawQuery)) {
        if (!map[key]) continue;

        const { dbField, operator, type } = map[key];

        if (type === 'date')
        {
            // Merge multiple conditions on the same field (e.g. joined_after + joined_before)
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

module.exports = mongoose.model('User', userSchema);