'use strict';

// Adjust these paths to match your actual project structure.
const userController = require('../controllers/user_controller');
const contentController = require('../controllers/content_controller');
const profileController = require('../controllers/profile_controller');
const reviewController = require('../controllers/review_controller');
const User = require('../models/user');
const Profile = require('../models/profile');
const Content = require('../models/content');
const Episode = require('../models/episode');
const Review = require('../models/review');
const { permissionManagerInstance, Permmision_Level } = require('../middlewares/permission_manager');
const { tokenManagerInstance } = require('../middlewares/token_manager');
const { MAX_PROFILES_LIMIT } = require('../scripts/constants');

// ==================== FAKE req/res HELPERS ====================
// Lets this module call the real controller functions directly, in-process,
// without going through HTTP - so it always exercises the actual validation
// and logic in the controllers rather than a reimplementation of it.

function buildFakeReq(overrides)
{
    return Object.assign({ body: {}, params: {}, query: {}, headers: {} }, overrides);
}

// Captures whatever the controller passes to res.json() so the caller can
// inspect it after awaiting the controller call.
function buildFakeRes()
{
    const res = { result: undefined };

    res.json = function json(data)
    {
        res.result = data;
        return res;
    };

    return res;
}

// ==================== CONFIGURATION (all the "knobs" for this seed run) ====================
// Every quantity/range the person asked to be adjustable lives here, at the top of the file.

const NUMBER_OF_USERS_TO_CREATE = 30;

// Each generated user ends up with a random TOTAL profile count in this range
// (register() already creates 1 default profile - extra ones are added on top of that).
// Capped at runtime to MAX_PROFILES_LIMIT (from constants.js), which is the real business rule.
const MIN_PROFILES_PER_USER = 1;
const MAX_PROFILES_PER_USER = 4;

// Only applies to content items that are randomly rolled as "series" (see seedContent()).
const MIN_SEASONS_PER_SERIES = 1;
const MAX_SEASONS_PER_SERIES = 3;
const MIN_EPISODES_PER_SEASON = 4;
const MAX_EPISODES_PER_SEASON = 10;

// How many random reviews each generated user ends up writing.
const MIN_REVIEWS_PER_USER = 2;
const MAX_REVIEWS_PER_USER = 6;

// Chance (0-1) that a generated review includes a comment at all - the rest are left blank.
const COMMENT_CHANCE = 0.6;

// Shared time window for "when did this happen" - used for BOTH user registration dates
// and content addition dates: each one gets a fully random createdAt somewhere between
// today and this many months back. Reviews don't get their own separate range - their
// date is instead constrained to always fall AFTER whichever came later (the reviewing
// user's registration date or the reviewed content's addition date) - see seedReviews().
const SEED_DATE_RANGE_MONTHS_BACK = 6;

// Video filenames that must already exist for real inside the server's video assets folder -
// every episode/movie created below picks one of these at random, it never invents a new name.
const AVAILABLE_VIDEO_FILENAMES = ['gavriela.mp4', 'spiderman.mp4', 'video1.mp4'];

// Name pools used to build random full names for the generated users. First/last names are
// picked independently, so the same first name (or last name) can appear on more than one user.
const FIRST_NAMES_POOL =
[
    'Dan', 'Noa', 'Amit', 'Tal', 'Roni', 'Yossi', 'Maya', 'Omer', 'Liron', 'Guy',
    'Shira', 'Eitan', 'Michal', 'Yuval', 'Nadav', 'Adi', 'Or', 'Hila', 'Ronit', 'Idan'
];
const LAST_NAMES_POOL =
[
    'Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Azoulay', 'Katz', 'Avraham', 'Dahan', 'Malka',
    'Shapiro', 'Gabai', 'Amar', 'Bar', 'Sasson', 'Elbaz', 'Barak', 'Golan', 'Harari', 'Segal'
];

// Generic filler text randomly attached to reviews (see COMMENT_CHANCE above).
const RANDOM_COMMENTS_POOL =
[
    'Really enjoyed this one, would recommend!',
    'Not bad, but the pacing felt a bit slow.',
    "One of the best things I've watched this year.",
    'Could not stop watching, binge-worthy!',
    'Decent, but I expected more from the ending.',
    'Great acting and cinematography.',
    'A bit overhyped in my opinion.',
    'Perfect for a weekend binge.',
    'The story dragged in the middle episodes.',
    'Solid entertainment, nothing groundbreaking though.'
];

// ==================== RANDOM HELPERS ====================

// Random integer between min and max, INCLUSIVE on both ends.
function getRandomInt(min, max)
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Picks one random element out of a non-empty array.
function getRandomElement(array)
{
    return array[getRandomInt(0, array.length - 1)];
}

// Builds a random adult birthday string ("YYYY-MM-DD"), matching what register() expects.
// Day is kept to 1-28 on purpose, so every month/year combination is always a valid date
// without needing separate leap-year/days-in-month logic.
function generateRandomAdultBirthday(minAge, maxAge)
{
    const currentYear = new Date().getFullYear();
    const age = getRandomInt(minAge, maxAge);
    const birthYear = currentYear - age;
    const birthMonth = String(getRandomInt(1, 12)).padStart(2, '0');
    const birthDay = String(getRandomInt(1, 28)).padStart(2, '0');
    return `${birthYear}-${birthMonth}-${birthDay}`;
}

// Returns a random Date strictly between startDate and endDate (inclusive on both ends).
// If the range is empty or inverted (startDate >= endDate), just returns endDate - this can
// happen with the review-date logic below, where the "start" is itself a random date.
function getRandomDateBetween(startDate, endDate)
{
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (startMs >= endMs)
    {
        return new Date(endMs);
    }

    const randomMs = startMs + Math.random() * (endMs - startMs);
    return new Date(randomMs);
}

// Random Date somewhere between `monthsBack` months ago and right now - used to spread out
// user registration dates and content addition dates, per SEED_DATE_RANGE_MONTHS_BACK.
function getRandomDateInPastMonths(monthsBack)
{
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setMonth(pastDate.getMonth() - monthsBack);
    return getRandomDateBetween(pastDate, now);
}

// ==================== SEED DATA: ADMIN ====================
// A dedicated 11th user, separate from the randomly generated regular users, created
// specifically to be promoted to SUPER_ADMIN (level 2). Shares the same
// seed password as everyone else for convenience.

const SEED_USER_PASSWORD = 'Password123!';

const seedAdminData = { firstName: 'Admin', lastName: 'Admin', birthday: '1990-01-01' };
const seedAdminEmail = (seedAdminData.firstName + '@mail.com').toLowerCase(); // admin@mail.com

// ==================== SEED DATA: CONTENT ====================
// Release dates verified against Wikipedia / IMDb / Netflix Tudum.
// Courtroom Queens only has a confirmed year (2024) on its official Netflix
// page, with no specific day published - Jan 1 is used as a placeholder for
// that one entry; all others have fully confirmed dates.
//
// NOTE: `type` and `videoUrl` used to be hardcoded here, but both are now generated
// randomly per item at seed time (see seedContent() below) - `type` is rolled fresh
// as "movie" or "series", and every episode/movie gets its own randomly picked
// videoUrl from AVAILABLE_VIDEO_FILENAMES - so neither field belongs in this list anymore.

//controller req.body = { title, description, cover_image_name, type, categories, release_date, age_limit }
const seedContentData =
[
    {
        title: 'Black Rabbit',
        cover_image_name: 'Black_Rabbit.jpg',
        categories: ['drama', 'crime', 'thriller'],
        description: 'When the owner of a New York City hotspot allows his chaotic brother back into his life, he opens the door to escalating dangers that threaten to bring down everything he\'s built.',
        release_date: '2025-09-18',
        age_limit: 16
    },
    {
        title: 'Courtroom Queens',
        cover_image_name: 'Courtroom_Queens.jpg',
        categories: ['reality', 'drama'],
        description: 'Six Israeli top criminal lawyers take on high-profile cases while juggling the complexities of a male-dominated field and their own personal dramas.',
        release_date: '2024-01-01',
        age_limit: 13
    },
    {
        title: 'East Side',
        cover_image_name: 'East_Side.jpg',
        categories: ['drama'],
        description: 'An ex-Secret Service agent-turned-fixer plays by his own rules as he brokers shady property deals between the Arab residents of East Jerusalem.',
        release_date: '2023-02-19',
        age_limit: 16
    },
    {
        title: 'Griselda',
        cover_image_name: 'Griselda.jpg',
        categories: ['crime', 'drama'],
        description: 'Chronicles the life of Griselda Blanco, who created one of the most profitable cartels in history.',
        release_date: '2024-01-25',
        age_limit: 18
    },
    {
        title: 'Nobody Wants This',
        cover_image_name: 'Nobody_Wants_This.jpg',
        categories: ['comedy', 'romance'],
        description: 'An agnostic sex podcaster and a newly single rabbi fall in love, but can their relationship survive their wildly different lives and meddling families?',
        release_date: '2024-09-26',
        age_limit: 16
    },
    {
        title: 'Off-Road',
        cover_image_name: 'OFFROAD.jpg',
        categories: ['reality', 'travel'],
        description: 'Two Israeli actors and real-life best friends embark on a 4x4 off-road trip through Kyrgyzstan and Kazakhstan, testing their friendship along the way.',
        release_date: '2025-07-10',
        age_limit: 12
    },
    {
        title: 'Running Point',
        cover_image_name: 'Running_Point.jpg',
        categories: ['comedy', 'sport'],
        description: 'A reformed party girl must prove herself as a businesswoman when she\'s unexpectedly put in charge of her family\'s pro basketball team.',
        release_date: '2025-02-27',
        age_limit: 16
    },
    {
        title: 'The Spy',
        cover_image_name: 'The_Spy.jpg',
        categories: ['drama', 'thriller'],
        description: 'In the 1960s, Israeli clerk-turned-secret agent Eli Cohen goes deep undercover inside Syria on a perilous, years-long mission to spy for Mossad.',
        release_date: '2019-09-06',
        age_limit: 16
    },
    {
        title: 'Zero Day',
        cover_image_name: 'Zero_Day.jpg',
        categories: ['thriller', 'drama'],
        description: 'A beloved and highly respected former United States president leads the investigation into a nationwide cyberattack while battling his own personal demons.',
        release_date: '2025-02-20',
        age_limit: 16
    }
];

// ==================== SEED STEPS ====================

async function clearExistingData()
{
    console.log('Clearing existing users, profiles, content, episodes, and reviews...');

    await User.deleteMany({});
    await Profile.deleteMany({});
    await Content.deleteMany({});
    await Episode.deleteMany({});
    await Review.deleteMany({});
    tokenManagerInstance.deleteAllTokens();
    permissionManagerInstance.authorized_list = {};
    permissionManagerInstance.save();

    console.log('Existing data cleared.');
}

// Calls the real userController.register to create the dedicated admin user,
// then promotes it to SUPER_ADMIN (level 2) directly via permissionManagerInstance
// (register() itself has no way to create an admin - permission is granted
// separately here, the same way ConsoleSetPermission / setpermission does).
async function seedAdmin()
{
    console.log('Creating admin user via userController.register...');

    const req = buildFakeReq({
        body:
        {
            email: seedAdminEmail,
            phone: '0500000000',
            password: SEED_USER_PASSWORD,
            fullName: seedAdminData.firstName + ' ' + seedAdminData.lastName,
            birthday: seedAdminData.birthday
        }
    });
    const res = buildFakeRes();

    await userController.register(req, res);

    if (!res.result || !res.result.success)
    {
        console.log('FAILED to create admin user: ' + (res.result ? res.result.message : 'no response'));
        return null;
    }

    console.log('Created admin user: ' + seedAdminEmail);

    const adminUser = await User.findOne({ email: seedAdminEmail });

    if (!adminUser)
    {
        console.log('Could not find admin user right after creating it - content will be created without an attributed admin_user_id.');
        return null;
    }

    permissionManagerInstance.setPermissionLevel(adminUser._id.toString(), Permmision_Level.SUPER_ADMIN);
    console.log('Promoted ' + seedAdminEmail + ' to SUPER_ADMIN (level ' + Permmision_Level.SUPER_ADMIN + ').');

    return adminUser._id.toString();
}

// Adds however many EXTRA profiles a user needs, on top of the 1 default profile that
// register()/addDefaultUser() already created for them - by calling the real
// profileController.createProfile the same way the real POST /profile/ route would
// (that controller only needs req.target_user_id, and internally delegates to the
// User model's own addProfile(), which enforces MAX_PROFILES_LIMIT).
async function seedExtraProfilesForUser(userId, fullNameForLogging)
{
    const maxAllowedProfiles = Math.min(MAX_PROFILES_PER_USER, MAX_PROFILES_LIMIT);
    const targetProfileCount = getRandomInt(MIN_PROFILES_PER_USER, maxAllowedProfiles);
    const extraProfilesNeeded = targetProfileCount - 1; // 1 default profile already exists

    let extraProfilesCreated = 0;

    for (let i = 0; i < extraProfilesNeeded; i++)
    {
        const req = buildFakeReq({ target_user_id: userId });
        const res = buildFakeRes();

        await profileController.createProfile(req, res);

        if (res.result && res.result.success)
        {
            extraProfilesCreated++;
        }
        else
        {
            console.log('FAILED to add extra profile for ' + fullNameForLogging + ': ' + (res.result ? res.result.message : 'no response'));
        }
    }

    console.log('Added ' + extraProfilesCreated + '/' + extraProfilesNeeded + ' extra profile(s) for ' + fullNameForLogging + ' (target total: ' + targetProfileCount + ').');
}

// Calls the real userController.register for NUMBER_OF_USERS_TO_CREATE randomly named users,
// then tops each one up to a random total profile count via seedExtraProfilesForUser(), and
// finally overwrites their auto-set createdAt with a random date within SEED_DATE_RANGE_MONTHS_BACK
// (register() itself has no way to pick a custom registration date, so this is done as a direct
// patch afterward via User.updateOne - not a reimplementation of any real logic, just a timestamp).
// Returns { userId, createdAt } for every user created, needed later by seedReviews() to keep
// review dates chronologically sensible.
async function seedUsers()
{
    console.log('Creating ' + NUMBER_OF_USERS_TO_CREATE + ' random seed users via userController.register...');

    const createdUsers = [];
    const usedEmails = new Set(); // random first/last name combos can repeat - keeps emails unique
    let successCount = 0;

    for (let i = 0; i < NUMBER_OF_USERS_TO_CREATE; i++)
    {
        const firstName = getRandomElement(FIRST_NAMES_POOL);
        const lastName = getRandomElement(LAST_NAMES_POOL);
        const fullName = firstName + ' ' + lastName;
        const birthday = generateRandomAdultBirthday(18, 70);
        const phone = '050' + String(1000000 + i).padStart(7, '0');

        // Keep appending a running counter until the email is unique among this run's users.
        let email = (firstName + '.' + lastName + '@mail.com').toLowerCase();
        let duplicateSuffix = 1;
        while (usedEmails.has(email))
        {
            duplicateSuffix++;
            email = (firstName + '.' + lastName + duplicateSuffix + '@mail.com').toLowerCase();
        }
        usedEmails.add(email);

        const req = buildFakeReq({
            body: { email, phone, password: SEED_USER_PASSWORD, fullName, birthday }
        });
        const res = buildFakeRes();

        await userController.register(req, res);

        if (!res.result || !res.result.success)
        {
            console.log('FAILED to create user ' + fullName + ': ' + (res.result ? res.result.message : 'no response'));
            continue;
        }

        successCount++;
        console.log('Created user: ' + fullName + ' (' + email + ')');

        const newUser = await User.findOne({ email });

        if (!newUser)
        {
            console.log('Could not find user right after creating it - skipping extra profiles for ' + fullName);
            continue;
        }

        // Give this user a random "registration date" somewhere in the last
        // SEED_DATE_RANGE_MONTHS_BACK months, instead of everyone sharing the exact
        // moment this seed script happened to run.
        const randomCreatedAt = getRandomDateInPastMonths(SEED_DATE_RANGE_MONTHS_BACK);
        await User.updateOne({ _id: newUser._id }, { $set: { createdAt: randomCreatedAt } });

        createdUsers.push({ userId: newUser._id.toString(), createdAt: randomCreatedAt });
        await seedExtraProfilesForUser(newUser._id.toString(), fullName);
    }

    console.log(successCount + '/' + NUMBER_OF_USERS_TO_CREATE + ' users created successfully.');
    console.log('All seed users share the password: ' + SEED_USER_PASSWORD);

    return createdUsers;
}

// Calls the real contentController.createContent for each seed content item, rolling a
// random type ("movie" or "series") for every item, then:
//   - series: creates a random number of seasons, each with a random number of episodes
//     (contentController.addEpisode), every one with its own randomly picked videoUrl.
//   - movie: sets a single randomly picked videoUrl (contentController.setMovieVideo).
// Also overwrites the content's auto-set createdAt with a random "media addition" date
// somewhere in the last SEED_DATE_RANGE_MONTHS_BACK months (createContent() has no way to
// pick a custom date itself, so this is a direct patch afterward via Content.updateOne).
// Returns { contentId, episodeId, contentCreatedAt } for every episode/movie-video
// successfully created, so seedReviews() below has real targets - and their content's
// addition date - to attach chronologically sensible random reviews to.
async function seedContent(adminUserId)
{
    console.log('Creating ' + seedContentData.length + ' content item(s) via contentController.createContent...');

    let successCount = 0;
    let episodeSuccessCount = 0;
    const createdEpisodeRefs = [];

    for (let i = 0; i < seedContentData.length; i++)
    {
        const contentData = seedContentData[i];
        const randomType = getRandomElement(['movie', 'series']);

        const req = buildFakeReq({ body: { ...contentData, type: randomType }, admin_user_id: adminUserId });
        const res = buildFakeRes();

        await contentController.createContent(req, res);

        if (!res.result || !res.result.success)
        {
            console.log('FAILED to create content "' + contentData.title + '": ' + (res.result ? res.result.message : 'no response'));
            continue;
        }

        successCount++;
        console.log('Created content: ' + contentData.title + ' (type: ' + randomType + ')');

        const newContentId = res.result.content.id;

        // Give this content item a random "addition date" somewhere in the last
        // SEED_DATE_RANGE_MONTHS_BACK months, instead of everyone sharing the exact
        // moment this seed script happened to run.
        const contentCreatedAt = getRandomDateInPastMonths(SEED_DATE_RANGE_MONTHS_BACK);
        await Content.updateOne({ _id: newContentId }, { $set: { createdAt: contentCreatedAt } });

        const contentDoc = await Content.findById(newContentId);

        if (randomType === 'series')
        {
            const seasonCount = getRandomInt(MIN_SEASONS_PER_SERIES, MAX_SEASONS_PER_SERIES);

            for (let seasonNumber = 1; seasonNumber <= seasonCount; seasonNumber++)
            {
                const episodeCount = getRandomInt(MIN_EPISODES_PER_SEASON, MAX_EPISODES_PER_SEASON);

                for (let episodeNumber = 1; episodeNumber <= episodeCount; episodeNumber++)
                {
                    const videoUrl = getRandomElement(AVAILABLE_VIDEO_FILENAMES);

                    const episodeReq = buildFakeReq({
                        params: { contentId: newContentId },
                        body: { season_number: seasonNumber, episode_number: episodeNumber, videoUrl },
                        admin_user_id: adminUserId,
                        content: contentDoc
                    });
                    const episodeRes = buildFakeRes();

                    await contentController.addEpisode(episodeReq, episodeRes);

                    if (episodeRes.result && episodeRes.result.success)
                    {
                        episodeSuccessCount++;
                        createdEpisodeRefs.push({ contentId: newContentId, episodeId: episodeRes.result.episode.id, contentCreatedAt });
                    }
                    else
                    {
                        console.log('FAILED to create S' + seasonNumber + 'E' + episodeNumber + ' for "' + contentData.title + '": ' + (episodeRes.result ? episodeRes.result.message : 'no response'));
                    }
                }
            }
        }
        else // randomType === 'movie'
        {
            const videoUrl = getRandomElement(AVAILABLE_VIDEO_FILENAMES);

            const movieReq = buildFakeReq({
                params: { contentId: newContentId },
                body: { videoUrl },
                admin_user_id: adminUserId,
                content: contentDoc
            });
            const movieRes = buildFakeRes();

            await contentController.setMovieVideo(movieReq, movieRes);

            if (movieRes.result && movieRes.result.success)
            {
                episodeSuccessCount++;
                createdEpisodeRefs.push({ contentId: newContentId, episodeId: movieRes.result.episode.id, contentCreatedAt });
            }
            else
            {
                console.log('FAILED to set movie video for "' + contentData.title + '": ' + (movieRes.result ? movieRes.result.message : 'no response'));
            }
        }
    }

    console.log(successCount + '/' + seedContentData.length + ' content items created successfully.');
    console.log(episodeSuccessCount + ' episode/movie-video entries created successfully.');

    return createdEpisodeRefs;
}

// Makes every generated user "write" a random number of reviews (MIN_REVIEWS_PER_USER to
// MAX_REVIEWS_PER_USER), each from a random one of that user's own profiles, targeting a
// random episode out of everything seedContent() created - via the real
// reviewController.addReview, the same way the real POST /reviews/:profileId/:contentId/:episodeId
// route would call it.
// Each review's createdAt is then overwritten (addReview() has no way to pick a custom date
// itself) with a random date that is always AFTER whichever came later - the reviewing user's
// registration date, or the reviewed content's addition date - and always before "now", so a
// review can never appear to have been written before its user existed or before the content
// was even added.
// Duplicate attempts (the same profile randomly picked to review the same episode twice) are
// expected occasionally and are simply skipped, not treated as errors - the schema's unique
// index on (episode_id, profile_id) already prevents them from ever being double-created.
async function seedReviews(createdUsers, createdEpisodeRefs)
{
    console.log('Creating random reviews for ' + createdUsers.length + ' seed user(s)...');

    if (createdEpisodeRefs.length === 0)
    {
        console.log('No episodes were created - skipping review seeding.');
        return 0;
    }

    let successCount = 0;
    let attemptCount = 0;
    const now = new Date();

    for (const { userId, createdAt: userCreatedAt } of createdUsers)
    {
        const userProfiles = await Profile.find({ user_id: userId });

        if (userProfiles.length === 0)
        {
            continue;
        }

        const reviewCount = getRandomInt(MIN_REVIEWS_PER_USER, MAX_REVIEWS_PER_USER);

        for (let i = 0; i < reviewCount; i++)
        {
            attemptCount++;

            const profile = getRandomElement(userProfiles);
            const episodeRef = getRandomElement(createdEpisodeRefs);
            const rating = getRandomInt(1, 10);
            const comment = (Math.random() < COMMENT_CHANCE) ? getRandomElement(RANDOM_COMMENTS_POOL) : undefined;

            // reviewController.addReview only ever reads _id off req.content/req.episode,
            // so small placeholder objects are enough here - no need for full documents.
            const req = buildFakeReq({
                target_user_id: userId,
                profile: profile,
                content: { _id: episodeRef.contentId },
                episode: { _id: episodeRef.episodeId },
                body: { rating, comment }
            });
            const res = buildFakeRes();

            await reviewController.addReview(req, res);

            if (res.result && res.result.success)
            {
                successCount++;

                // The review can only have happened after BOTH the user existed and the
                // content existed - so the random window starts at whichever of those two
                // dates is later, and always ends at "now".
                const earliestPossibleDate = (userCreatedAt > episodeRef.contentCreatedAt) ? userCreatedAt : episodeRef.contentCreatedAt;
                const reviewCreatedAt = getRandomDateBetween(earliestPossibleDate, now);

                await Review.updateOne({ _id: res.result.review.id }, { $set: { createdAt: reviewCreatedAt } });
            }
        }
    }

    console.log(successCount + '/' + attemptCount + ' random reviews created successfully (some attempts are expected to be skipped as duplicates).');

    return successCount;
}

// ==================== PUBLIC ENTRY POINT ====================
// Assumes the DB connection is already open (managed by server.js's connectDB()).
// Does not connect/disconnect - that lifecycle belongs to the caller.

async function seedDatabase()
{
    console.log('=== SEEDING DATABASE ===');

    await clearExistingData();
    const adminUserId = await seedAdmin();
    const createdUsers = await seedUsers();
    const createdEpisodeRefs = await seedContent(adminUserId);
    const reviewsCreated = await seedReviews(createdUsers, createdEpisodeRefs);

    console.log('=== SEED COMPLETE ===');
    console.log('Admin created: ' + (adminUserId ? seedAdminEmail : 'FAILED'));
    console.log('Users created: ' + createdUsers.length + '/' + NUMBER_OF_USERS_TO_CREATE);
    console.log('Content items created: ' + seedContentData.length + ' attempted');
    console.log('Episodes/movie-videos created: ' + createdEpisodeRefs.length);
    console.log('Reviews created: ' + reviewsCreated);
}

module.exports = { seedDatabase };