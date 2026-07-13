'use strict';

// Adjust these paths to match your actual project structure.
const userController = require('../controllers/user_controller');
const contentController = require('../controllers/content_controller');
const User = require('../models/user');
const Profile = require('../models/profile');
const Content = require('../models/content');
const Episode = require('../models/episode');
const Review = require('../models/review');
const { permissionManagerInstance, Permmision_Level } = require('../middlewares/permission_manager');
const {tokenManagerInstance } = require('../middlewares/token_manager');

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

// ==================== SEED DATA: ADMIN ====================
// A dedicated 11th user, separate from the 10 regular seed users, created
// specifically to be promoted to SUPER_ADMIN (level 2). Shares the same
// seed password as everyone else for convenience.

const SEED_USER_PASSWORD = 'Password123!';

const seedAdminData = { firstName: 'Admin', lastName: 'Admin', birthday: '1990-01-01' };
const seedAdminEmail = (seedAdminData.firstName + '@mail.com').toLowerCase(); // admin@mail.com

// ==================== SEED DATA: USERS ====================
// 10 regular users with distinct names, all with a shared known password for
// easy manual testing. All are well over 18 (register() enforces a minimum
// age of 18).

const seedUsersData =
[
    { firstName: 'Dan', lastName: 'Cohen', birthday: '1988-03-12' },
    { firstName: 'Noa', lastName: 'Levi', birthday: '1990-07-24' },
    { firstName: 'Amit', lastName: 'Mizrahi', birthday: '1985-01-05' },
    { firstName: 'Tal', lastName: 'Peretz', birthday: '1993-11-30' },
    { firstName: 'Roni', lastName: 'Biton', birthday: '1979-06-18' },
    { firstName: 'Yossi', lastName: 'Azoulay', birthday: '1995-09-02' },
    { firstName: 'Maya', lastName: 'Katz', birthday: '1982-04-27' },
    { firstName: 'Omer', lastName: 'Avraham', birthday: '1998-12-14' },
    { firstName: 'Liron', lastName: 'Dahan', birthday: '1991-08-08' },
    { firstName: 'Guy', lastName: 'Malka', birthday: '1987-02-21' }
];

// ==================== SEED DATA: CONTENT ====================
// Release dates verified against Wikipedia / IMDb / Netflix Tudum.
// Courtroom Queens only has a confirmed year (2024) on its official Netflix
// page, with no specific day published - Jan 1 is used as a placeholder for
// that one entry; all others have fully confirmed dates.
// videoUrl here is NOT sent to createContent (Content no longer has that field) -
// it is used afterward to create each series' season 1 / episode 1 (see seedContent).

//controller req.body = { title, description, cover_image_name, type, categories, release_date, age_limit }
const seedContentData =
[
    {
        title: 'Black Rabbit',
        cover_image_name: 'Black_Rabbit.jpg',
        type: 'series',
        categories: ['drama', 'crime', 'thriller'],
        description: 'When the owner of a New York City hotspot allows his chaotic brother back into his life, he opens the door to escalating dangers that threaten to bring down everything he\'s built.',
        release_date: '2025-09-18',
        videoUrl: 'gavriela.mp4',
        age_limit: 16
    },
    {
        title: 'Courtroom Queens',
        cover_image_name: 'Courtroom_Queens.jpg',
        type: 'series',
        categories: ['reality', 'drama'],
        description: 'Six Israeli top criminal lawyers take on high-profile cases while juggling the complexities of a male-dominated field and their own personal dramas.',
        release_date: '2024-01-01',
        videoUrl: 'spiderman.mp4',
        age_limit: 13
    },
    {
        title: 'East Side',
        cover_image_name: 'East_Side.jpg',
        type: 'series',
        categories: ['drama'],
        description: 'An ex-Secret Service agent-turned-fixer plays by his own rules as he brokers shady property deals between the Arab residents of East Jerusalem.',
        release_date: '2023-02-19',
        videoUrl: 'gavriela.mp4',
        age_limit: 16
    },
    {
        title: 'Griselda',
        cover_image_name: 'Griselda.jpg',
        type: 'series',
        categories: ['crime', 'drama'],
        description: 'Chronicles the life of Griselda Blanco, who created one of the most profitable cartels in history.',
        release_date: '2024-01-25',
        videoUrl: 'gavriela.mp4',
        age_limit: 18
    },
    {
        title: 'Nobody Wants This',
        cover_image_name: 'Nobody_Wants_This.jpg',
        type: 'series',
        categories: ['comedy', 'romance'],
        description: 'An agnostic sex podcaster and a newly single rabbi fall in love, but can their relationship survive their wildly different lives and meddling families?',
        release_date: '2024-09-26',
        videoUrl: 'spiderman.mp4',
        age_limit: 16
    },
    {
        title: 'Off-Road',
        cover_image_name: 'OFFROAD.jpg',
        type: 'series',
        categories: ['reality', 'travel'],
        description: 'Two Israeli actors and real-life best friends embark on a 4x4 off-road trip through Kyrgyzstan and Kazakhstan, testing their friendship along the way.',
        release_date: '2025-07-10',
        videoUrl: 'spiderman.mp4',
        age_limit: 12
    },
    {
        title: 'Running Point',
        cover_image_name: 'Running_Point.jpg',
        type: 'series',
        categories: ['comedy', 'sport'],
        description: 'A reformed party girl must prove herself as a businesswoman when she\'s unexpectedly put in charge of her family\'s pro basketball team.',
        release_date: '2025-02-27',
        videoUrl: 'video1.mp4',
        age_limit: 16
    },
    {
        title: 'The Spy',
        cover_image_name: 'The_Spy.jpg',
        type: 'series',
        categories: ['drama', 'thriller'],
        description: 'In the 1960s, Israeli clerk-turned-secret agent Eli Cohen goes deep undercover inside Syria on a perilous, years-long mission to spy for Mossad.',
        release_date: '2019-09-06',
        videoUrl: 'spiderman.mp4',
        age_limit: 16
    },
    {
        title: 'Zero Day',
        cover_image_name: 'Zero_Day.jpg',
        type: 'series',
        categories: ['thriller', 'drama'],
        description: 'A beloved and highly respected former United States president leads the investigation into a nationwide cyberattack while battling his own personal demons.',
        release_date: '2025-02-20',
        videoUrl: 'video1.mp4',
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

// Calls the real userController.register for each of the 10 regular seed users.
async function seedUsers()
{
    console.log('Creating ' + seedUsersData.length + ' seed users via userController.register...');

    let successCount = 0;

    for (let i = 0; i < seedUsersData.length; i++)
    {
        const userData = seedUsersData[i];
        const fullName = userData.firstName + ' ' + userData.lastName;
        const email = (userData.firstName + '@mail.com').toLowerCase();
        const phone = '050' + String(1000000 + i).padStart(7, '0');

        const req = buildFakeReq({
            body:
            {
                email: email,
                phone: phone,
                password: SEED_USER_PASSWORD,
                fullName: fullName,
                birthday: userData.birthday
            }
        });
        const res = buildFakeRes();

        await userController.register(req, res);

        if (res.result && res.result.success)
        {
            successCount++;
            console.log('Created user: ' + fullName + ' (' + email + ')');
        }
        else
        {
            console.log('FAILED to create user ' + fullName + ': ' + (res.result ? res.result.message : 'no response'));
        }
    }

    console.log(successCount + '/' + seedUsersData.length + ' users created successfully.');
    console.log('All seed users share the password: ' + SEED_USER_PASSWORD);

    return successCount;
}

// Calls the real contentController.createContent for each seed content item,
// then (since every seed item is a "series") adds a single season 1 / episode 1
// via contentController.addEpisode, carrying over that item's videoUrl - otherwise
// the videoUrl in seedContentData would go completely unused, since Content no
// longer has a videoUrl field of its own.
async function seedContent(adminUserId)
{
    console.log('Creating ' + seedContentData.length + ' initial content item(s) via contentController.createContent...');

    let successCount = 0;
    let episodeSuccessCount = 0;

    for (let i = 0; i < seedContentData.length; i++)
    {
        const contentData = seedContentData[i];

        const req = buildFakeReq({ body: contentData, admin_user_id: adminUserId });
        const res = buildFakeRes();

        await contentController.createContent(req, res);

        if (!res.result || !res.result.success)
        {
            console.log('FAILED to create content "' + contentData.title + '": ' + (res.result ? res.result.message : 'no response'));
            continue;
        }

        successCount++;
        console.log('Created content: ' + contentData.title);

        const newContentId = res.result.content.id;

        const episodeReq = buildFakeReq({
            params: { contentId: newContentId },
            body: { season_number: 1, episode_number: 1, videoUrl: contentData.videoUrl },
            admin_user_id: adminUserId,
            content: await Content.findById(newContentId)
        });
        const episodeRes = buildFakeRes();

        await contentController.addEpisode(episodeReq, episodeRes);

        if (episodeRes.result && episodeRes.result.success)
        {
            episodeSuccessCount++;
        }
        else
        {
            console.log('FAILED to create episode for "' + contentData.title + '": ' + (episodeRes.result ? episodeRes.result.message : 'no response'));
        }
    }

    console.log(successCount + '/' + seedContentData.length + ' content items created successfully.');
    console.log(episodeSuccessCount + '/' + successCount + ' season 1 / episode 1 entries created successfully.');

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
    const usersCreated = await seedUsers();
    const contentCreated = await seedContent(adminUserId);

    console.log('=== SEED COMPLETE ===');
    console.log('Admin created: ' + (adminUserId ? seedAdminEmail : 'FAILED'));
    console.log('Users created: ' + usersCreated + '/' + seedUsersData.length);
    console.log('Content items created: ' + contentCreated + '/' + seedContentData.length);
}

module.exports = { seedDatabase };