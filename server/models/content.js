const mongoose = require("mongoose");

const contentSchema = new mongoose. Schema(
{
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, default: "" },
    cover_image_name: { type: String, required: true, default: "UNDEFINED_COVER.png" },
    type: { type: String, required: true, enum: ["movie", "series"] },
    categories: { type: [String], required: true },
    release_date: { type: Date, required: true, default: Date.now },
    age_limit: { type: Number, default: 0, index: true }, // Index added for age filtering
    likes: { type: Number, default: 0 }, // Changed from rating to likes
    videoUrl: { type: String, required: true }
}
, 
{ 
    timestamps: true 
}
);

// Compound index for performance
// 1. Filtering by age and category
// 2. Sorting by likes to get the "Top 10" instantly
contentSchema.index({ type: 1 });
contentSchema.index({ categories: 1 });
contentSchema.index({ release_date: 1 });
contentSchema.index({ age_limit: 1 }); 
contentSchema.index({ likes: -1 }); // Critical for "Top 10" queries

module.exports = mongoose.model("Content", contentSchema);