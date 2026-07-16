const User = require('../models/user');
const Content = require('../models/content');
const Episode = require('../models/episode');
const Review = require('../models/review');
const Profile = require('../models/profile');
const my_logger = require('../scripts/my_logger');
const constants = require('../scripts/constants');

const AGE_BOUNDARIES = [18, 25, 35, 45, 60, 90];
const MONTHS_BACK_FOR_GROWTH = 6;

/**
 * Get aggregated statistics about all users on the server (profile distribution, growth over time, age distribution)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: {
//    success: boolean,
//    message: string,
//    statistics: {
//        profileDistribution: Array<{ NumberOfProfiles: number, UsersCount: number }>, // 1..MAX_PROFILES_LIMIT, 0 if none
//        userGrowth: Array<{ Month: string, NewUsers: number }>, // "YYYY-MM", last MONTHS_BACK_FOR_GROWTH months, 0 if none
//        ageDistribution: Array<{ AgeRange: string, UsersCount: number }> // from AGE_BOUNDARIES + "120+" bucket, 0 if none
//    }
//}
const getUsersStatistics = async (req, res) => {
    try {
        // ---------- 1. Profile count distribution per user ----------

        // Step 1: for each user, count how many profiles they have
        const countProfilesPerUserStage = {
            $project: {
                profileCount: { $size: { $ifNull: ["$profile_ids", []] } }
            }
        };

        // Step 2: group users together by their profile count
        const groupUsersByProfileCountStage = {
            $group: {
                _id: "$profileCount",
                totalUsers: { $sum: 1 }
            }
        };

        // Step 3: sort results from lowest profile count to highest
        const sortByProfileCountStage = {
            $sort: { _id: 1 }
        };

        const profileDistributionRaw = await User.aggregate([
            countProfilesPerUserStage,
            groupUsersByProfileCountStage,
            sortByProfileCountStage
        ]);

        // Fill in every possible profile count (1..MAX_PROFILES_LIMIT), including zeros,
        // reading the limit fresh from constants (not baked into the model/schema)
        const maxProfilesLimit = constants.MAX_PROFILES_LIMIT;
        const usersCountByProfileCountMap = new Map(profileDistributionRaw.map(item => [item._id, item.totalUsers]));
        const profileDistribution = [];
        for (let numberOfProfiles = 1; numberOfProfiles <= maxProfilesLimit; numberOfProfiles++) {
            profileDistribution.push({
                NumberOfProfiles: numberOfProfiles,
                UsersCount: usersCountByProfileCountMap.get(numberOfProfiles) || 0
            });
        }

        // ---------- 2. User growth over the last MONTHS_BACK_FOR_GROWTH months ----------

        // Step 1: only look at users created within the last MONTHS_BACK_FOR_GROWTH months
        const growthRangeStartDate = new Date();
        growthRangeStartDate.setMonth(growthRangeStartDate.getMonth() - MONTHS_BACK_FOR_GROWTH);
        const filterRecentUsersStage = {
            $match: { createdAt: { $gte: growthRangeStartDate } }
        };

        // Step 2: group users by the year-month they were created in
        const groupUsersByJoinMonthStage = {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                newUsers: { $sum: 1 }
            }
        };

        // Step 3: sort results from earliest month to latest
        const sortByMonthStage = {
            $sort: { _id: 1 }
        };

        const userGrowthRaw = await User.aggregate([
            filterRecentUsersStage,
            groupUsersByJoinMonthStage,
            sortByMonthStage
        ]);

        // Fill in every one of the last MONTHS_BACK_FOR_GROWTH months (including the current one),
        // including zeros for months with no new users
        const newUsersByMonthMap = new Map(userGrowthRaw.map(item => [item._id, item.newUsers]));
        const userGrowth = [];
        const monthCursor = new Date(growthRangeStartDate);
        monthCursor.setDate(1);
        const currentDate = new Date();
        while (monthCursor.getFullYear() < currentDate.getFullYear() ||
              (monthCursor.getFullYear() === currentDate.getFullYear() && monthCursor.getMonth() <= currentDate.getMonth())) {
            const monthKey = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;
            userGrowth.push({
                Month: monthKey,
                NewUsers: newUsersByMonthMap.get(monthKey) || 0
            });
            monthCursor.setMonth(monthCursor.getMonth() + 1);
        }

        // ---------- 3. Age distribution (calculated directly from birth_date) ----------

        // Step 1: calculate each user's current age from their birth_date
        const calculateAgeStage = {
            $project: {
                age: {
                    $subtract: [
                        { $year: new Date() },
                        { $year: "$birth_date" }
                    ]
                }
            }
        };

        // Step 2: group users into age ranges (buckets) based on AGE_BOUNDARIES.
        // Infinity is appended so the last real boundary (120) becomes its own bucket
        // for "120+", instead of falling into the default bucket together with <18.
        const groupUsersIntoAgeBucketsStage = {
            $bucket: {
                groupBy: "$age",
                boundaries: [...AGE_BOUNDARIES, Infinity],
                default: "Under 18 / Invalid",
                output: { count: { $sum: 1 } }
            }
        };

        const ageDistributionRaw = await User.aggregate([
            calculateAgeStage,
            groupUsersIntoAgeBucketsStage
        ]);

        // Fill in every age range derived from AGE_BOUNDARIES, including zeros,
        // plus the "Under 18 / Invalid" default bucket and a final "120+" bucket
        const usersCountByAgeBucketMap = new Map(ageDistributionRaw.map(item => [item._id, item.count]));
        const ageDistribution = [
            { AgeRange: "Under 18 / Invalid", UsersCount: usersCountByAgeBucketMap.get("Under 18 / Invalid") || 0 }
        ];
        for (let boundaryIndex = 0; boundaryIndex < AGE_BOUNDARIES.length - 1; boundaryIndex++) {
            const rangeLabel = `${AGE_BOUNDARIES[boundaryIndex]}-${AGE_BOUNDARIES[boundaryIndex + 1] - 1}`;
            ageDistribution.push({
                AgeRange: rangeLabel,
                UsersCount: usersCountByAgeBucketMap.get(AGE_BOUNDARIES[boundaryIndex]) || 0
            });
        }
        const finalAgeBoundary = AGE_BOUNDARIES[AGE_BOUNDARIES.length - 1];
        ageDistribution.push({
            AgeRange: `${finalAgeBoundary}+`,
            UsersCount: usersCountByAgeBucketMap.get(finalAgeBoundary) || 0
        });

        my_logger.ConsoleLog(`getUsersStatistics successful.`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getUsersStatistics', 'Users statistics fetched successfully.', {}, my_logger.Log_Level.INFO);

        res.json({
            success: true,
            message: 'Users statistics fetched successfully',
            statistics: {
                profileDistribution,
                userGrowth,
                ageDistribution
            }
        });
    } catch (error) {
        my_logger.ConsoleLog(`Error fetching users statistics: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getUsersStatistics', 'Error fetching users statistics.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
};


const CONTENT_AGE_BOUNDARIES = [0, 7, 13, 16, 18];
const EPISODE_COUNT_BOUNDARIES = [1, 5, 10, 20, 50];
const MOST_VIEWED_CONTENT_LIMIT = 5;

/**
 * Get aggregated statistics about all content on the server (views per category, category distribution, episodes-per-series stats, age distribution)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: {
//    success: boolean,
//    message: string,
//    statistics: {
//        viewsByCategory: Array<{ Category: string, ViewsCount: number }>, // one entry per category found in the DB (or "Uncategorized"), sorted by ViewsCount desc.
//            A "view" is counted once per unique content_id a profile has watched (repeated episodes of the
//            same series/movie count once). Content belonging to multiple categories contributes once to each.
//        categoryDistribution: Array<{ Category: string, TitlesCount: number }>, // one entry per category found in the DB, sorted by TitlesCount desc
//        episodesPerSeriesStats: {
//            averageEpisodesPerSeries: number, // series with 0 episodes count as 0
//            episodesDistribution: Array<{ EpisodesRange: string, SeriesCount: number }> // "0" + EPISODE_COUNT_BOUNDARIES ranges + open-ended top range, 0 if none
//        },
//        ageDistribution: Array<{ AgeRange: string, TitlesCount: number }> // "Invalid" + CONTENT_AGE_BOUNDARIES ranges + open-ended top range, 0 if none
//    }
//}
const getContentStatistics = async (req, res) => {
    try {
        // ---------- 1. Views per category ---------- 
        // Step 1: collect each profile's unique watched content ids (dedupe repeated episodes of the same content)
        const projectUniqueContentIdsStage = {
            $project: {
                uniqueContentIds: { $setUnion: ["$last_watched.content_id", []] }
            }
        };
 
        // Step 2: unwind so each (profile, uniquely-watched content) pair becomes its own document = one "view"
        const unwindUniqueContentIdsStage = {
            $unwind: "$uniqueContentIds"
        };
 
        // Step 3: join each view with its Content document
        const lookupContentStage = {
            $lookup: {
                from: "contents", // Mongoose's default pluralized collection name for the "Content" model
                localField: "uniqueContentIds",
                foreignField: "_id",
                as: "watchedContent"
            }
        };
 
        // Step 4: drop the array wrapper from the $lookup (also filters out dangling/broken references)
        const unwindWatchedContentStage = {
            $unwind: "$watchedContent"
        };
 
        // Step 5: unwind the content's categories, keeping content with an empty categories array
        // as a single null entry (handled as "Uncategorized" in the group stage below)
        const unwindContentCategoriesStage = {
            $unwind: {
                path: "$watchedContent.categories",
                preserveNullAndEmptyArrays: true
            }
        };
 
        // Step 6: group and count views per category, labeling missing categories as "Uncategorized"
        const groupViewsByCategoryStage = {
            $group: {
                _id: { $ifNull: ["$watchedContent.categories", "Uncategorized"] },
                viewsCount: { $sum: 1 }
            }
        };
 
        // Step 7: sort from most-viewed category to least-viewed
        const sortByViewsCountStage = {
            $sort: { viewsCount: -1 }
        };
 
        const viewsByCategoryRaw = await Profile.aggregate([
            projectUniqueContentIdsStage,
            unwindUniqueContentIdsStage,
            lookupContentStage,
            unwindWatchedContentStage,
            unwindContentCategoriesStage,
            groupViewsByCategoryStage,
            sortByViewsCountStage
        ]);
 
        const viewsByCategory = viewsByCategoryRaw.map(item => ({
            Category: item._id,
            ViewsCount: item.viewsCount
        }));
 
        // ---------- 2. Most viewed content (top MOST_VIEWED_CONTENT_LIMIT titles) ----------
 
        // Same "view" definition as above (one view per unique content_id watched by a
        // profile), but grouped directly by content instead of by category, so we can
        // rank individual titles rather than categories.
 
        // Step 1: group views by content id, counting how many profiles have watched each one
        const groupViewsByContentIdStage = {
            $group: {
                _id: "$uniqueContentIds",
                viewsCount: { $sum: 1 }
            }
        };
 
        // Step 2: sort from most-viewed to least-viewed
        const sortMostViewedContentStage = {
            $sort: { viewsCount: -1 }
        };
 
        // Step 3: keep only the top MOST_VIEWED_CONTENT_LIMIT titles
        const limitMostViewedContentStage = {
            $limit: MOST_VIEWED_CONTENT_LIMIT
        };
 
        // Step 4: join each top content id with its Content document to get its title
        const lookupMostViewedContentStage = {
            $lookup: {
                from: "contents", // Mongoose's default pluralized collection name for the "Content" model
                localField: "_id",
                foreignField: "_id",
                as: "contentInfo"
            }
        };
 
        // Step 5: drop the array wrapper from the $lookup (also filters out dangling/broken references)
        const unwindMostViewedContentInfoStage = {
            $unwind: "$contentInfo"
        };
 
        const mostViewedContentRaw = await Profile.aggregate([
            projectUniqueContentIdsStage,
            unwindUniqueContentIdsStage,
            groupViewsByContentIdStage,
            sortMostViewedContentStage,
            limitMostViewedContentStage,
            lookupMostViewedContentStage,
            unwindMostViewedContentInfoStage
        ]);
 
        const mostViewedContent = mostViewedContentRaw.map(item => ({
            Title: item.contentInfo.title,
            ViewsCount: item.viewsCount
        }));
 
        // ---------- 3. Category distribution (across all content) ----------
 
        // Step 1: split each content document into one row per category it belongs to
        const splitContentByCategoryStage = {
            $unwind: "$categories"
        };
 
        // Step 2: group content rows by category name
        const groupContentByCategoryStage = {
            $group: {
                _id: "$categories",
                titlesCount: { $sum: 1 }
            }
        };
 
        // Step 3: sort categories from most titles to least
        const sortByTitlesCountDescStage = {
            $sort: { titlesCount: -1 }
        };
 
        const categoryDistributionRaw = await Content.aggregate([
            splitContentByCategoryStage,
            groupContentByCategoryStage,
            sortByTitlesCountDescStage
        ]);
 
        const categoryDistribution = categoryDistributionRaw.map(categoryEntry => ({
            Category: categoryEntry._id,
            TitlesCount: categoryEntry.titlesCount
        }));
 
        // ---------- 4. Episodes-per-series stats ----------
 
        // Step 1: keep only content documents that are series
        const filterSeriesOnlyStage = {
            $match: { type: "series" }
        };
 
        // Step 2: keep only the _id field of each series
        const keepOnlySeriesIdStage = {
            $project: { _id: 1 }
        };
 
        const seriesContentDocs = await Content.aggregate([
            filterSeriesOnlyStage,
            keepOnlySeriesIdStage
        ]);
        const seriesContentIds = seriesContentDocs.map(seriesDoc => seriesDoc._id);
 
        // Step 3: keep only episodes belonging to one of those series
        const filterEpisodesOfSeriesStage = {
            $match: { content_id: { $in: seriesContentIds } }
        };
 
        // Step 4: count episodes per series
        const groupEpisodesByContentIdStage = {
            $group: {
                _id: "$content_id",
                episodesCount: { $sum: 1 }
            }
        };
 
        const episodeCountPerSeriesRaw = await Episode.aggregate([
            filterEpisodesOfSeriesStage,
            groupEpisodesByContentIdStage
        ]);
 
        // Map each series id to its actual episode count, defaulting to 0 for series with no episodes at all
        const episodesCountBySeriesIdMap = new Map(episodeCountPerSeriesRaw.map(item => [item._id.toString(), item.episodesCount]));
        const episodeCountsForAllSeries = seriesContentIds.map(seriesId => episodesCountBySeriesIdMap.get(seriesId.toString()) || 0);
 
        // Calculate the average episode count across all series
        const totalSeriesCount = episodeCountsForAllSeries.length;
        const totalEpisodesAcrossAllSeries = episodeCountsForAllSeries.reduce((sum, count) => sum + count, 0);
        const averageEpisodesPerSeries = totalSeriesCount > 0 ? (totalEpisodesAcrossAllSeries / totalSeriesCount) : 0;
 
        // Bucket every series by its episode count, using EPISODE_COUNT_BOUNDARIES (plus a "0" bucket and an open-ended top bucket)
        const episodesDistributionCountMap = new Map();
        episodesDistributionCountMap.set("0", 0);
        for (let boundaryIndex = 0; boundaryIndex < EPISODE_COUNT_BOUNDARIES.length - 1; boundaryIndex++) {
            const rangeLabel = `${EPISODE_COUNT_BOUNDARIES[boundaryIndex]}-${EPISODE_COUNT_BOUNDARIES[boundaryIndex + 1] - 1}`;
            episodesDistributionCountMap.set(rangeLabel, 0);
        }
        const finalEpisodeBoundary = EPISODE_COUNT_BOUNDARIES[EPISODE_COUNT_BOUNDARIES.length - 1];
        const openEndedEpisodeRangeLabel = `${finalEpisodeBoundary}+`;
        episodesDistributionCountMap.set(openEndedEpisodeRangeLabel, 0);
 
        for (const episodeCount of episodeCountsForAllSeries) {
            let matchedRangeLabel = openEndedEpisodeRangeLabel;
            if (episodeCount === 0) {
                matchedRangeLabel = "0";
            } else {
                for (let boundaryIndex = 0; boundaryIndex < EPISODE_COUNT_BOUNDARIES.length - 1; boundaryIndex++) {
                    if (episodeCount >= EPISODE_COUNT_BOUNDARIES[boundaryIndex] && episodeCount < EPISODE_COUNT_BOUNDARIES[boundaryIndex + 1]) {
                        matchedRangeLabel = `${EPISODE_COUNT_BOUNDARIES[boundaryIndex]}-${EPISODE_COUNT_BOUNDARIES[boundaryIndex + 1] - 1}`;
                        break;
                    }
                }
            }
            episodesDistributionCountMap.set(matchedRangeLabel, episodesDistributionCountMap.get(matchedRangeLabel) + 1);
        }
 
        const episodesDistribution = Array.from(episodesDistributionCountMap.entries()).map(([rangeLabel, seriesCount]) => ({
            EpisodesRange: rangeLabel,
            SeriesCount: seriesCount
        }));
 
        const episodesPerSeriesStats = {
            averageEpisodesPerSeries,
            episodesDistribution
        };
 
        // ---------- 5. Age distribution of content (based on age_limit) ----------
 
        // Step 1: group content into age-limit ranges (buckets) based on CONTENT_AGE_BOUNDARIES.
        // Infinity is appended so the last real boundary (18) becomes its own open-ended "18+" bucket.
        const groupContentIntoAgeBucketsStage = {
            $bucket: {
                groupBy: "$age_limit",
                boundaries: [...CONTENT_AGE_BOUNDARIES, Infinity],
                default: "Invalid",
                output: { titlesCount: { $sum: 1 } }
            }
        };
 
        const ageDistributionRaw = await Content.aggregate([
            groupContentIntoAgeBucketsStage
        ]);
 
        // Fill in every age range derived from CONTENT_AGE_BOUNDARIES, including zeros,
        // plus the "Invalid" default bucket and a final open-ended bucket
        const titlesCountByAgeBucketMap = new Map(ageDistributionRaw.map(item => [item._id, item.titlesCount]));
        const ageDistribution = [
            { AgeRange: "Invalid", TitlesCount: titlesCountByAgeBucketMap.get("Invalid") || 0 }
        ];
        for (let boundaryIndex = 0; boundaryIndex < CONTENT_AGE_BOUNDARIES.length - 1; boundaryIndex++) {
            const rangeLabel = `${CONTENT_AGE_BOUNDARIES[boundaryIndex]}-${CONTENT_AGE_BOUNDARIES[boundaryIndex + 1] - 1}`;
            ageDistribution.push({
                AgeRange: rangeLabel,
                TitlesCount: titlesCountByAgeBucketMap.get(CONTENT_AGE_BOUNDARIES[boundaryIndex]) || 0
            });
        }
        const finalContentAgeBoundary = CONTENT_AGE_BOUNDARIES[CONTENT_AGE_BOUNDARIES.length - 1];
        ageDistribution.push({
            AgeRange: `${finalContentAgeBoundary}+`,
            TitlesCount: titlesCountByAgeBucketMap.get(finalContentAgeBoundary) || 0
        });
 
        my_logger.ConsoleLog(`getContentStatistics successful.`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getContentStatistics', 'Content statistics fetched successfully.', {}, my_logger.Log_Level.INFO);
 
        res.json({
            success: true,
            message: 'Content statistics fetched successfully',
            statistics: {
                viewsByCategory,
                mostViewedContent,
                categoryDistribution,
                episodesPerSeriesStats,
                ageDistribution
            }
        });
    } catch (error) {
        my_logger.ConsoleLog(`Error fetching content statistics: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getContentStatistics', 'Error fetching content statistics.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
};

const RATING_MIN = 1;
const RATING_MAX = 10;
const MONTHS_BACK_FOR_REVIEWS_GROWTH = 6;

/**
 * Get aggregated statistics about all reviews on the server (rating distribution, average rating per category, average rating per month)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The response object
 */
//res.json: {
//    success: boolean,
//    message: string,
//    statistics: {
//        ratingDistribution: Array<{ Rating: number, ReviewsCount: number }>, // RATING_MIN..RATING_MAX, 0 if none
//        categoryAverageRating: Array<{ Category: string, AverageRating: number, ReviewsCount: number }>, // one entry per category found in reviewed content
//        monthlyAverageRating: Array<{ Month: string, AverageRating: number, ReviewsCount: number }> // "YYYY-MM", last MONTHS_BACK_FOR_REVIEWS_GROWTH months, 0 if none
//    }
//}
const getReviewsStatistics = async (req, res) => {
    try {
        // ---------- 1. Rating distribution (1-10) ----------

        // Step 1: group reviews by their exact rating value
        const groupReviewsByRatingStage = {
            $group: {
                _id: "$rating",
                reviewsCount: { $sum: 1 }
            }
        };

        const ratingDistributionRaw = await Review.aggregate([
            groupReviewsByRatingStage
        ]);

        // Fill in every possible rating from RATING_MIN to RATING_MAX, including zeros
        const reviewsCountByRatingMap = new Map(ratingDistributionRaw.map(item => [item._id, item.reviewsCount]));
        const ratingDistribution = [];
        for (let rating = RATING_MIN; rating <= RATING_MAX; rating++) {
            ratingDistribution.push({
                Rating: rating,
                ReviewsCount: reviewsCountByRatingMap.get(rating) || 0
            });
        }

        // ---------- 2. Average rating per category ----------

        // Step 1: attach the reviewed content document to each review
        const joinReviewsWithContentStage = {
            $lookup: {
                from: Content.collection.name,
                localField: "content_id",
                foreignField: "_id",
                as: "contentDoc"
            }
        };

        // Step 2: the lookup returns an array, so unwind it into a single document
        const unwindContentDocStage = {
            $unwind: "$contentDoc"
        };

        // Step 3: split each review into one row per category its content belongs to
        const splitReviewsByCategoryStage = {
            $unwind: "$contentDoc.categories"
        };

        // Step 4: group reviews by category, computing average rating and review count
        const groupReviewsByCategoryStage = {
            $group: {
                _id: "$contentDoc.categories",
                averageRating: { $avg: "$rating" },
                reviewsCount: { $sum: 1 }
            }
        };

        // Step 5: sort categories from most reviewed to least
        const sortByReviewsCountDescStage = {
            $sort: { reviewsCount: -1 }
        };

        const categoryAverageRatingRaw = await Review.aggregate([
            joinReviewsWithContentStage,
            unwindContentDocStage,
            splitReviewsByCategoryStage,
            groupReviewsByCategoryStage,
            sortByReviewsCountDescStage
        ]);

        const categoryAverageRating = categoryAverageRatingRaw.map(categoryEntry => ({
            Category: categoryEntry._id,
            AverageRating: categoryEntry.averageRating,
            ReviewsCount: categoryEntry.reviewsCount
        }));

        // ---------- 3. Average rating per month (last MONTHS_BACK_FOR_REVIEWS_GROWTH months) ----------

        // Step 1: only look at reviews created within the last MONTHS_BACK_FOR_REVIEWS_GROWTH months
        const monthlyRangeStartDate = new Date();
        monthlyRangeStartDate.setMonth(monthlyRangeStartDate.getMonth() - MONTHS_BACK_FOR_REVIEWS_GROWTH);
        const filterRecentReviewsStage = {
            $match: { createdAt: { $gte: monthlyRangeStartDate } }
        };

        // Step 2: group reviews by the year-month they were created in
        const groupReviewsByMonthStage = {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                averageRating: { $avg: "$rating" },
                reviewsCount: { $sum: 1 }
            }
        };

        // Step 3: sort results from earliest month to latest
        const sortByMonthStage = {
            $sort: { _id: 1 }
        };

        const monthlyAverageRatingRaw = await Review.aggregate([
            filterRecentReviewsStage,
            groupReviewsByMonthStage,
            sortByMonthStage
        ]);

        // Fill in every one of the last MONTHS_BACK_FOR_REVIEWS_GROWTH months (including the current one),
        // including zeros for months with no reviews
        const monthlyStatsByMonthMap = new Map(monthlyAverageRatingRaw.map(item => [item._id, { averageRating: item.averageRating, reviewsCount: item.reviewsCount }]));
        const monthlyAverageRating = [];
        const monthCursor = new Date(monthlyRangeStartDate);
        monthCursor.setDate(1);
        const currentDate = new Date();
        while (monthCursor.getFullYear() < currentDate.getFullYear() ||
              (monthCursor.getFullYear() === currentDate.getFullYear() && monthCursor.getMonth() <= currentDate.getMonth())) {
            const monthKey = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;
            const monthStats = monthlyStatsByMonthMap.get(monthKey);
            monthlyAverageRating.push({
                Month: monthKey,
                AverageRating: monthStats ? monthStats.averageRating : 0,
                ReviewsCount: monthStats ? monthStats.reviewsCount : 0
            });
            monthCursor.setMonth(monthCursor.getMonth() + 1);
        }

        my_logger.ConsoleLog(`getReviewsStatistics successful.`, my_logger.Log_Level.INFO);
        my_logger.OperationLog('getReviewsStatistics', 'Reviews statistics fetched successfully.', {}, my_logger.Log_Level.INFO);

        res.json({
            success: true,
            message: 'Reviews statistics fetched successfully',
            statistics: {
                ratingDistribution,
                categoryAverageRating,
                monthlyAverageRating
            }
        });
    } catch (error) {
        my_logger.ConsoleLog(`Error fetching reviews statistics: ${error}`, my_logger.Log_Level.ERROR);
        my_logger.OperationLog('getReviewsStatistics', 'Error fetching reviews statistics.', { "error": error }, my_logger.Log_Level.ERROR);
        res.json({ success: false, message: 'Internal server error' });
    }
};



module.exports = 
{
    getUsersStatistics,
    getContentStatistics,
    getReviewsStatistics
}