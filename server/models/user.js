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

userSchema.methods.GetProfilesCollection = async function()
{
    return await this.model('Profile').find({ _id: { $in: this.profileIds } });
};

/**
 * Static method to create a new user with a mandatory default profile.
 * Executes within a transaction to ensure that both the User and the 
 * default Profile are created together, or not at all.
 */
userSchema.statics.DefaultUser = async function(email, password, fullName, phone, birthDate)
{
    // Start a Mongoose session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try
    {
        const User = this;

        // 1. Create a new User instance in-memory to generate an _id
        // We generate the _id explicitly so we can pass it to the profile
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

        // 2. Create the default profile using the pre-generated user ID
        // This ensures the profile can be correctly linked to the user
        let defaultProfile = await Profile.DefaultProfile(userId);
        await defaultProfile.save({ session });

        // 3. Link the profile ID to the user document
        user.profileIds.push(defaultProfile._id);

        // 4. Save the user document within the same session
        await user.save({ session });

        // 5. Commit the transaction if all operations succeed
        await session.commitTransaction();
        return user;
    }
    catch (error) 
    {
        // Rollback all changes if any part of the process fails
        await session.abortTransaction();
        throw new Error("Failed to create user and default profile.", { cause: error });
    }
    finally
    {
        // Always end the session to free up resources
        session.endSession();
    }
};
/**
 * Adds a profile ID atomically to prevent race conditions.
 * Uses $addToSet to prevent duplicates and a query filter to enforce the limit.
 */
userSchema.methods.addProfile = async function() 
{
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try 
    {
        const user = await this.model('User').findById(this._id).session(session);
        if (user.profileIds.length >= MAX_PROFILES_LIMIT)
        {
            throw new Error(`Profile limit (${MAX_PROFILES_LIMIT}) reached`);
        }

        const newProfile = await Profile.DefaultProfile(this._id);
        await newProfile.save({ session });

        await this.model('User').updateOne(
            { _id: this._id },
            { $addToSet: { profileIds: newProfile._id } },
            { session }
        );

        await session.commitTransaction();
        return newProfile;
    } 
    catch (error) 
    {
        // Rollback all operations if anything fails
        await session.abortTransaction();
        throw error;
    } 
    finally 
    {
        session.endSession();
    }
};

/**
 * Removes a profile ID atomically using $pull.
 * Ensures that the user cannot remove their last remaining profile.
 */
userSchema.methods.removeProfile = async function(profileId)
{
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Delete the profile from the Profiles collection
        const profileDeletion = await this.model('Profile').deleteOne(
            { _id: profileId, User_ID: this._id }, 
            { session }
        );

        if (profileDeletion.deletedCount === 0) {
            throw new Error("Profile not found or access denied.");
        }

        // 2. Remove the profile ID from the User's array
        const result = await this.model('User').updateOne(
            { 
                _id: this._id,
                $expr: { $gt: [{ $size: "$profileIds" }, 1] } 
            },
            { $pull: { profileIds: profileId } },
            { session }
        );

        if (result.modifiedCount === 0) {
            throw new Error("Cannot remove the last profile.");
        }

        await session.commitTransaction();
        return true;
    } 
    catch (error) 
    {
        // Rollback ensures that if user update fails, the profile is NOT deleted
        await session.abortTransaction();
        throw error;
    } 
    finally 
    {
        session.endSession();
    }
};

userSchema.statics.searchFilterMap = 
{
    'born_after':   { dbField: 'birthDate', operator: '$gte' },
    'born_before':  { dbField: 'birthDate', operator: '$lte' },
    'joined_after': { dbField: 'createdAt', operator: '$gte' },
    'joined_before':{ dbField: 'createdAt', operator: '$lte' },
    'email_starts': { dbField: 'email',     operator: 'regex_start' },
    'phone_starts': { dbField: 'phone',     operator: 'regex_start' }
};

userSchema.statics.buildQuery = function(query) 
{
    const dbFilter = {};
    const map = this.searchFilterMap;

    for (const [key, value] of Object.entries(query)) {
        if (!map[key]) continue;

        const { dbField, operator } = map[key];

        if (operator === 'regex_start') 
        {
            dbFilter[dbField] = { $regex: `^${value}`, $options: 'i' };
        } else {
            if (!dbFilter[dbField]) dbFilter[dbField] = {};
            dbFilter[dbField][operator] = new Date(value);
        }
    }
    return dbFilter;
};

module.exports = mongoose.model('User', userSchema);