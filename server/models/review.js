const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
{
    contentId:
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Content", 
        required: true, 
        index: true 
    },
    profileId:
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Profile", 
        required: true 
    },

    userId:
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true, 
        index: true
    },
    rating:
    { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 5 
    },
    comment:
    { 
        type: String, 
        trim: true, 
        maxlength: 500 
    }
},
{ 
    timestamps: true 
});

//only one review for each profile!
reviewSchema.index({ contentId: 1, profileId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);