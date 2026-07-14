'use strict';

// #############################################################################
// #                                  COMMON                                  #
// #############################################################################

var readline = require('readline');

// ==================== CONFIGURATION ====================
// Adjust to match your local server setup.

var SERVER_HOST = 'localhost';
var SERVER_PORT = 3000;
var BASE_PATH = '/api';

// Leave empty to be asked interactively at startup, or fill in to skip the prompt.
// NOTE: this script creates and deletes content as a fixture, and deletes users
// for cleanup - both require SUPER_ADMIN permission level.
var ADMIN_EMAIL_OR_PHONE = 'admin@mail.com';
var ADMIN_PASSWORD = 'Password123!';

// ==================== GLOBAL STATE ====================

var adminToken = null;

// ==================== HTTP HELPER (fetch based) ====================

async function requestAsync(method, path, body, token)
{
    var url = 'http://' + SERVER_HOST + ':' + SERVER_PORT + BASE_PATH + path;
    var headers = { 'Connection': 'close' };
    var fetchOptions = { method: method, headers: headers };

    if (body !== null && body !== undefined)
    {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(body);
    }

    if (token)
    {
        headers['Authorization'] = 'Bearer ' + token;
    }

    var response = await fetch(url, fetchOptions);
    var parsedData = null;

    try
    {
        parsedData = await response.json();
    }
    catch (parseError)
    {
        parsedData = null;
    }

    return { statusCode: response.status, data: parsedData };
}

// ==================== CONSOLE INPUT HELPER ====================

function askQuestion(rl, query)
{
    return new Promise(function executor(resolve)
    {
        rl.question(query, function onAnswer(answer)
        {
            resolve(answer);
        });
    });
}

async function resolveAdminCredentials()
{
    var isEmailConfigured = ADMIN_EMAIL_OR_PHONE !== null && ADMIN_EMAIL_OR_PHONE !== undefined && ADMIN_EMAIL_OR_PHONE.length > 0;
    var isPasswordConfigured = ADMIN_PASSWORD !== null && ADMIN_PASSWORD !== undefined && ADMIN_PASSWORD.length > 0;

    if (isEmailConfigured && isPasswordConfigured)
    {
        console.log('Using admin credentials from configuration.\n');
        return { email: ADMIN_EMAIL_OR_PHONE, password: ADMIN_PASSWORD };
    }

    var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    var enteredEmail = isEmailConfigured ? ADMIN_EMAIL_OR_PHONE : await askQuestion(rl, 'Enter admin email or phone: ');
    var enteredPassword = isPasswordConfigured ? ADMIN_PASSWORD : await askQuestion(rl, 'Enter admin password: ');
    rl.close();

    return { email: enteredEmail, password: enteredPassword };
}

// ==================== TEST DATA GENERATION ====================

function generateRandomUser(prefix)
{
    var randomNumber = Math.floor(Math.random() * 1000000);
    var firstNames = ['Dan', 'Noa', 'Amit', 'Tal', 'Roni', 'Yossi', 'Maya', 'Omer', 'Liron', 'Guy'];
    var lastNames = ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Azoulay', 'Katz', 'Avraham', 'Dahan', 'Malka'];

    var firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    var lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    var fullName = firstName + ' ' + lastName;
    var email = prefix + randomNumber + '@example.com';
    var phone = '05' + (10000000 + Math.floor(Math.random() * 89999999));
    var password = 'Password' + randomNumber + '!';
    var birthday = '1990-01-01';

    return { email: email, phone: phone, password: password, fullName: fullName, birthday: birthday };
}

// ==================== API WRAPPER FUNCTIONS ====================

async function loginAdmin(email, password)
{
    var response = await requestAsync('POST', '/user/login', { email_or_phone: email, password: password }, null);

    if (!response.data || !response.data.success)
    {
        throw new Error('Admin login failed: ' + (response.data ? response.data.message : 'no response from server'));
    }

    return response.data.token;
}

async function logoutAdmin(token)
{
    var response = await requestAsync('POST', '/user/logout', null, token);
    return response.data;
}

async function registerUser(userData)
{
    var response = await requestAsync('POST', '/user/register', userData, null);
    return response.data;
}

async function loginUser(userData)
{
    var response = await requestAsync('POST', '/user/login', { email_or_phone: userData.email, password: userData.password }, null);
    return response.data;
}

async function getUserInfo(token)
{
    var response = await requestAsync('GET', '/user/me', null, token);
    return response.data;
}

async function deleteUserAsAdmin(targetUserId)
{
    var response = await requestAsync('DELETE', '/admin/users/' + targetUserId, null, adminToken);
    return response.data;
}

// --- Content fixture (admin) ---

async function createContentAsAdmin(payload)
{
    var response = await requestAsync('POST', '/admin/content', payload, adminToken);
    return response.data;
}

async function addEpisodeAsAdmin(contentId, payload)
{
    var response = await requestAsync('POST', '/admin/content/' + contentId + '/episodes', payload, adminToken);
    return response.data;
}

async function setMovieVideoAsAdmin(contentId, payload)
{
    var response = await requestAsync('PUT', '/admin/content/' + contentId + '/movie-video', payload, adminToken);
    return response.data;
}

async function deleteContentAsAdmin(contentId)
{
    var response = await requestAsync('DELETE', '/admin/content/' + contentId, null, adminToken);
    return response.data;
}

// --- Profile routes under test ---

async function createProfile(token)
{
    var response = await requestAsync('POST', '/profile', null, token);
    return response.data;
}

async function getAllProfiles(token)
{
    var response = await requestAsync('GET', '/profile', null, token);
    return response.data;
}

async function getProfile(token, profileId)
{
    var response = await requestAsync('GET', '/profile/' + profileId, null, token);
    return response.data;
}

async function getProfileDetails(token, profileId)
{
    var response = await requestAsync('GET', '/profile/' + profileId + '/details', null, token);
    return response.data;
}

async function updateProfile(token, profileId, changes)
{
    var response = await requestAsync('PUT', '/profile/' + profileId, changes, token);
    return response.data;
}

async function updateAllProfiles(token, updates)
{
    var response = await requestAsync('PUT', '/profile', { updates: updates }, token);
    return response.data;
}

async function deleteProfile(token, profileId)
{
    var response = await requestAsync('DELETE', '/profile/' + profileId, null, token);
    return response.data;
}

async function pressLike(token, profileId, contentId)
{
    var response = await requestAsync('POST', '/profile/' + profileId + '/likes/' + contentId, null, token);
    return response.data;
}

async function watchMedia(token, profileId, contentId, episodeId)
{
    var path = '/profile/' + profileId + '/watch/' + contentId + (episodeId ? '/' + episodeId : '');
    var response = await requestAsync('POST', path, null, token);
    return response.data;
}

async function getRecommendations(token, profileId)
{
    var response = await requestAsync('GET', '/profile/' + profileId + '/other_profiles_recommendations', null, token);
    return response.data;
}

// ==================== RESULT LOGGING HELPERS ====================

function createStats()
{
    return { passed: 0, total: 0 };
}

function recordPass(stats, message)
{
    stats.passed = stats.passed + 1;
    stats.total = stats.total + 1;
    console.log('PASS - ' + message);
}

function recordFail(stats, message)
{
    stats.total = stats.total + 1;
    console.log('FAIL - ' + message);
}

function checkFailed(stats, label, data, expectedMessageSubstring)
{
    if (data && data.success === false)
    {
        if (expectedMessageSubstring && (!data.message || data.message.indexOf(expectedMessageSubstring) === -1))
        {
            recordFail(stats, label + ' - failed as expected, but message did not mention "' + expectedMessageSubstring + '". Got: ' + data.message);
        }
        else
        {
            recordPass(stats, label + ' - correctly rejected. Message: ' + data.message);
        }
    }
    else
    {
        recordFail(stats, label + ' - was NOT rejected, this should not happen! Got: ' + JSON.stringify(data));
    }
}

// Creates a registered + logged in user, ready to use in tests.
async function setupTestUser(prefix)
{
    var userData = generateRandomUser(prefix);
    var registerResult = await registerUser(userData);

    if (!registerResult || !registerResult.success)
    {
        throw new Error('could not register test user: ' + (registerResult ? registerResult.message : 'no response'));
    }

    var loginResult = await loginUser(userData);
    var infoResult = await getUserInfo(loginResult.token);

    return { userData: userData, userId: infoResult.user.id, token: loginResult.token };
}

// #############################################################################
// #             FIXTURE - test series with two episodes                     #
// #############################################################################

async function createFixtureSeries()
{
    var contentResult = await createContentAsAdmin({
        title: 'Profile Test Series ' + Math.floor(Math.random() * 1000000),
        type: 'series',
        release_date: '2020-01-01',
        age_limit: 0
    });

    if (!contentResult || !contentResult.success)
    {
        throw new Error('could not create fixture series: ' + (contentResult ? contentResult.message : 'no response'));
    }

    var contentId = contentResult.content.id;

    var episode1Result = await addEpisodeAsAdmin(contentId, { season_number: 1, episode_number: 1, title: 'Pilot' });
    var episode2Result = await addEpisodeAsAdmin(contentId, { season_number: 1, episode_number: 2, title: 'Second Episode' });

    if (!episode1Result || !episode1Result.success || !episode2Result || !episode2Result.success)
    {
        throw new Error('could not add fixture episodes');
    }

    return { contentId: contentId, episode1Id: episode1Result.episode.id, episode2Id: episode2Result.episode.id };
}

// #############################################################################
// #        FIXTURE - test movie with a single video, via setMovieVideo      #
// #############################################################################

async function createFixtureMovie()
{
    var movieResult = await createContentAsAdmin({
        title: 'Profile Test Movie ' + Math.floor(Math.random() * 1000000),
        type: 'movie',
        release_date: '2018-01-01',
        age_limit: 0
    });

    if (!movieResult || !movieResult.success)
    {
        throw new Error('could not create fixture movie: ' + (movieResult ? movieResult.message : 'no response'));
    }

    var movieId = movieResult.content.id;
    var setVideoResult = await setMovieVideoAsAdmin(movieId, { videoUrl: 'profile_test_movie.mp4' });

    if (!setVideoResult || !setVideoResult.success)
    {
        throw new Error('could not set fixture movie video: ' + (setVideoResult ? setVideoResult.message : 'no response'));
    }

    return { movieId: movieId, episodeId: setVideoResult.episode.id };
}

// #############################################################################
// #                    STAGE 1 - "PROFILE CRUD"                             #
// #############################################################################

async function stageOneProfileCrud()
{
    console.log('\n========== STAGE 1: PROFILE CRUD ==========\n');

    var stats = createStats();
    var testUser = await setupTestUser('profcrud_');

    console.log('Getting the default profile that register/first login should already have or not - reading current list');
    var initialList = await getAllProfiles(testUser.token);

    if (initialList && initialList.success)
    {
        recordPass(stats, 'GET /profile returned the profile list');
    }
    else
    {
        recordFail(stats, 'GET /profile failed: ' + (initialList ? initialList.message : 'no response'));
    }

    var existingCount = initialList && initialList.profiles ? initialList.profiles.length : 0;
    var profileIds = initialList && initialList.profiles ? initialList.profiles.map(function toId(p) { return p.id; }) : [];

    console.log('Creating profiles until the max limit (4) is reached');

    for (var i = existingCount; i < 4; i++)
    {
        var createResult = await createProfile(testUser.token);

        if (createResult && createResult.success)
        {
            recordPass(stats, 'created profile #' + (i + 1));
            profileIds = createResult.profiles.map(function toId(p) { return p.id; });
        }
        else
        {
            recordFail(stats, 'failed to create profile #' + (i + 1) + ': ' + (createResult ? createResult.message : 'no response'));
        }
    }

    console.log('Attempting to create a 5th profile (should fail - limit reached)');
    var overLimitResult = await createProfile(testUser.token);
    checkFailed(stats, 'creating a 5th profile', overLimitResult, null);

    var firstProfileId = profileIds[0];

    console.log('Getting a single profile by ID: ' + firstProfileId);
    var singleGetResult = await getProfile(testUser.token, firstProfileId);

    if (singleGetResult && singleGetResult.success && singleGetResult.profile.id === firstProfileId)
    {
        recordPass(stats, 'GET /profile/:profileId returned the correct profile');
    }
    else
    {
        recordFail(stats, 'GET /profile/:profileId did not return the expected profile: ' + JSON.stringify(singleGetResult));
    }

    console.log('Updating the profile\'s name/age/image');
    var expectedName = 'Updated' + Math.floor(Math.random() * 1000000);
    var updateResult = await updateProfile(testUser.token, firstProfileId, { profileName: expectedName, age: 25, ImageName: 'pic.png' });

    if (updateResult && updateResult.success)
    {
        var updatedSummary = updateResult.profiles.filter(function matches(p) { return p.id === firstProfileId; })[0];

        if (updatedSummary && updatedSummary.profileName === expectedName && updatedSummary.age === 25)
        {
            recordPass(stats, 'update response reflects the new values');
        }
        else
        {
            recordFail(stats, 'update response does not reflect the new values: ' + JSON.stringify(updatedSummary));
        }
    }
    else
    {
        recordFail(stats, 'profile update request failed: ' + (updateResult ? updateResult.message : 'no response'));
    }

    console.log('Re-fetching profile details to confirm the update persisted');
    var detailsResult = await getProfileDetails(testUser.token, firstProfileId);

    if (detailsResult && detailsResult.success && detailsResult.profile.profileName === expectedName)
    {
        recordPass(stats, 'update persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'update was NOT persisted: ' + JSON.stringify(detailsResult));
    }

    console.log('Deleting one profile');
    var deleteResult = await deleteProfile(testUser.token, profileIds[1]);

    if (deleteResult && deleteResult.success)
    {
        recordPass(stats, 'profile deleted successfully');
    }
    else
    {
        recordFail(stats, 'profile delete failed: ' + (deleteResult ? deleteResult.message : 'no response'));
    }

    console.log('Deleting profiles down to the last one, then attempting to delete the last one (should fail)');
    var remainingList = await getAllProfiles(testUser.token);
    var remainingIds = remainingList.profiles.map(function toId(p) { return p.id; });

    for (var j = 0; j < remainingIds.length - 1; j++)
    {
        await deleteProfile(testUser.token, remainingIds[j]);
    }

    var lastProfileId = remainingIds[remainingIds.length - 1];
    var deleteLastResult = await deleteProfile(testUser.token, lastProfileId);
    checkFailed(stats, 'deleting the last remaining profile', deleteLastResult, null);

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [testUser.userId] };
}

// #############################################################################
// #                 STAGE 2 - "PROFILE OWNERSHIP"                           #
// #############################################################################

async function stageTwoProfileOwnership()
{
    console.log('\n========== STAGE 2: PROFILE OWNERSHIP ==========\n');

    var stats = createStats();

    var owner = await setupTestUser('own_owner_');
    var attacker = await setupTestUser('own_attacker_');

    var createResult = await createProfile(owner.token);
    var victimProfileId = createResult.profiles[0].id;

    console.log('Attacker attempting GET /profile/:profileId on the owner\'s profile');
    var getResult = await getProfile(attacker.token, victimProfileId);
    checkFailed(stats, 'cross-user GET profile', getResult, null);

    console.log('Attacker attempting GET /profile/:profileId/details on the owner\'s profile');
    var detailsResult = await getProfileDetails(attacker.token, victimProfileId);
    checkFailed(stats, 'cross-user GET profile details', detailsResult, null);

    console.log('Attacker attempting PUT /profile/:profileId on the owner\'s profile');
    var updateResult = await updateProfile(attacker.token, victimProfileId, { profileName: 'Hacked' });
    checkFailed(stats, 'cross-user update profile', updateResult, null);

    console.log('Attacker attempting DELETE /profile/:profileId on the owner\'s profile');
    var deleteResult = await deleteProfile(attacker.token, victimProfileId);
    checkFailed(stats, 'cross-user delete profile', deleteResult, null);

    console.log('Confirming the owner\'s profile is untouched');
    var stillThereResult = await getProfile(owner.token, victimProfileId);

    if (stillThereResult && stillThereResult.success && stillThereResult.profile.profileName !== 'Hacked')
    {
        recordPass(stats, 'owner\'s profile was left untouched by the attacker');
    }
    else
    {
        recordFail(stats, 'owner\'s profile appears to have been modified by the attacker!');
    }

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [owner.userId, attacker.userId] };
}

// #############################################################################
// #                    STAGE 3 - "BULK PROFILE UPDATE"                      #
// #############################################################################

async function stageThreeBulkUpdate()
{
    console.log('\n========== STAGE 3: BULK PROFILE UPDATE ==========\n');

    var stats = createStats();

    var userA = await setupTestUser('bulk_a_');
    var userB = await setupTestUser('bulk_b_');

    var createA2 = await createProfile(userA.token);
    var listA = await getAllProfiles(userA.token);
    var profileIdsA = listA.profiles.map(function toId(p) { return p.id; });

    var createB = await createProfile(userB.token);
    var profileIdBOther = createB.profiles[0].id;

    console.log('Bulk-updating both of user A\'s profiles, plus (illegitimately) trying to include user B\'s profile');
    var updates = [
        { profileId: profileIdsA[0], profileName: 'BulkOne' },
        { profileId: profileIdsA[1], profileName: 'BulkTwo' },
        { profileId: profileIdBOther, profileName: 'ShouldNotApply' }
    ];

    var bulkResult = await updateAllProfiles(userA.token, updates);

    if (bulkResult && bulkResult.success)
    {
        recordPass(stats, 'bulk update request succeeded');
    }
    else
    {
        recordFail(stats, 'bulk update request failed: ' + (bulkResult ? bulkResult.message : 'no response'));
    }

    var afterList = await getAllProfiles(userA.token);
    var updatedOne = afterList.profiles.filter(function matches(p) { return p.id === profileIdsA[0]; })[0];
    var updatedTwo = afterList.profiles.filter(function matches(p) { return p.id === profileIdsA[1]; })[0];

    if (updatedOne && updatedOne.profileName === 'BulkOne' && updatedTwo && updatedTwo.profileName === 'BulkTwo')
    {
        recordPass(stats, 'both of user A\'s profiles were updated correctly');
    }
    else
    {
        recordFail(stats, 'user A\'s profiles were not updated as expected: ' + JSON.stringify(afterList.profiles));
    }

    console.log('Confirming user B\'s profile was silently skipped (not owned by user A)');
    var userBProfile = await getProfile(userB.token, profileIdBOther);

    if (userBProfile && userBProfile.success && userBProfile.profile.profileName !== 'ShouldNotApply')
    {
        recordPass(stats, 'user B\'s profile was correctly left untouched by user A\'s bulk update');
    }
    else
    {
        recordFail(stats, 'user B\'s profile appears to have been modified by user A\'s bulk update!');
    }

    console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [userA.userId, userB.userId] };
}

// #############################################################################
// #           STAGE 4 - "LIKES & WATCH HISTORY (WITH RESUME)"               #
// #############################################################################

async function stageFourLikesAndWatch(fixture)
{
    console.log('\n========== STAGE 4: LIKES & WATCH HISTORY ==========\n');

    var stats = createStats();
    var testUser = await setupTestUser('watch_');

    var createResult = await createProfile(testUser.token);
    var profileId = createResult.profiles[0].id;

    console.log('Pressing like on the fixture content');
    var likeResult = await pressLike(testUser.token, profileId, fixture.contentId);

    if (likeResult && likeResult.success && likeResult.liked === true && likeResult.likedContentIds.indexOf(fixture.contentId) !== -1)
    {
        recordPass(stats, 'like response confirms the content was added');
    }
    else
    {
        recordFail(stats, 'like response did not confirm the content was added: ' + JSON.stringify(likeResult));
    }

    var detailsAfterLike = await getProfileDetails(testUser.token, profileId);

    if (detailsAfterLike && detailsAfterLike.success && detailsAfterLike.profile.likedContentIds.indexOf(fixture.contentId) !== -1)
    {
        recordPass(stats, 'like persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'like was NOT persisted on the server');
    }

    console.log('Pressing like again (should toggle it off)');
    var unlikeResult = await pressLike(testUser.token, profileId, fixture.contentId);

    if (unlikeResult && unlikeResult.success && unlikeResult.liked === false && unlikeResult.likedContentIds.indexOf(fixture.contentId) === -1)
    {
        recordPass(stats, 'unlike response confirms the content was removed');
    }
    else
    {
        recordFail(stats, 'unlike response did not confirm the content was removed: ' + JSON.stringify(unlikeResult));
    }

    console.log('Watching the fixture content with no specific episode (should default to season 1, episode 1)');
    var defaultWatchResult = await watchMedia(testUser.token, profileId, fixture.contentId, null);

    if (defaultWatchResult && defaultWatchResult.success && defaultWatchResult.episode && defaultWatchResult.episode.id === fixture.episode1Id)
    {
        recordPass(stats, 'default watch correctly recorded episode 1 (S1E1)');
    }
    else
    {
        recordFail(stats, 'default watch did not record S1E1 as expected: ' + JSON.stringify(defaultWatchResult));
    }

    console.log('Watching the fixture content again with no specific episode (should resume from S1E1, not re-default it away)');
    var resumeAtE1Result = await watchMedia(testUser.token, profileId, fixture.contentId, null);

    if (resumeAtE1Result && resumeAtE1Result.success && resumeAtE1Result.episode.id === fixture.episode1Id)
    {
        recordPass(stats, 'resume behavior correctly kept episode 1 as the saved episode');
    }
    else
    {
        recordFail(stats, 'resume behavior did not keep episode 1: ' + JSON.stringify(resumeAtE1Result));
    }

    console.log('Watching a specific episode explicitly (episode 2)');
    var explicitWatchResult = await watchMedia(testUser.token, profileId, fixture.contentId, fixture.episode2Id);

    if (explicitWatchResult && explicitWatchResult.success && explicitWatchResult.episode.id === fixture.episode2Id)
    {
        recordPass(stats, 'explicit watch correctly recorded episode 2');
    }
    else
    {
        recordFail(stats, 'explicit watch did not record episode 2 as expected: ' + JSON.stringify(explicitWatchResult));
    }

    console.log('Watching the same content again with no specific episode (should now resume from episode 2, not S1E1)');
    var resumeAtE2Result = await watchMedia(testUser.token, profileId, fixture.contentId, null);

    if (resumeAtE2Result && resumeAtE2Result.success && resumeAtE2Result.episode.id === fixture.episode2Id)
    {
        recordPass(stats, 'resume behavior correctly picked up episode 2 as the last saved episode');
    }
    else
    {
        recordFail(stats, 'resume behavior did NOT pick up episode 2, this is the core resume feature - got: ' + JSON.stringify(resumeAtE2Result));
    }

    console.log('Confirming there is exactly one lastWatched entry for this content (not one per episode)');
    var finalDetails = await getProfileDetails(testUser.token, profileId);
    var matchingEntries = finalDetails.profile.lastWatched.filter(function matches(entry) { return entry.content_id === fixture.contentId; });

    if (matchingEntries.length === 1)
    {
        recordPass(stats, 'exactly one lastWatched entry exists for this content, as expected');
    }
    else
    {
        recordFail(stats, 'expected exactly one lastWatched entry for this content, found ' + matchingEntries.length);
    }

    console.log('\nSTAGE 4 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [testUser.userId] };
}

// #############################################################################
// #                  STAGE 5 - "RECOMMENDATIONS"                            #
// #############################################################################

async function stageFiveRecommendations(fixture)
{
    console.log('\n========== STAGE 5: OTHER PROFILES RECOMMENDATIONS ==========\n');

    var stats = createStats();
    var testUser = await setupTestUser('recs_');

    console.log('Creating two profiles on the same account');
    var createResult1 = await createProfile(testUser.token);
    var profileOneId = createResult1.profiles[0].id;
    var createResult2 = await createProfile(testUser.token);
    var listAfter = await getAllProfiles(testUser.token);
    var profileTwoId = listAfter.profiles.filter(function notFirst(p) { return p.id !== profileOneId; })[0].id;

    console.log('Profile two watches the fixture content');
    await watchMedia(testUser.token, profileTwoId, fixture.contentId, fixture.episode1Id);

    console.log('Checking that profile one gets the fixture content recommended (profile two engaged with it)');
    var recsBefore = await getRecommendations(testUser.token, profileOneId);

    if (recsBefore && recsBefore.success)
    {
        var foundBefore = recsBefore.content.filter(function matches(c) { return c.id === fixture.contentId; }).length > 0;

        if (foundBefore)
        {
            recordPass(stats, 'profile one correctly received the fixture content as a recommendation');
        }
        else
        {
            recordFail(stats, 'profile one did NOT receive the fixture content as a recommendation, even though profile two watched it');
        }
    }
    else
    {
        recordFail(stats, 'recommendations request failed: ' + (recsBefore ? recsBefore.message : 'no response'));
    }

    console.log('Profile one also watches the fixture content itself');
    await watchMedia(testUser.token, profileOneId, fixture.contentId, fixture.episode1Id);

    console.log('Checking that the fixture content is now excluded from profile one\'s recommendations (already watched by itself)');
    var recsAfter = await getRecommendations(testUser.token, profileOneId);

    if (recsAfter && recsAfter.success)
    {
        var foundAfter = recsAfter.content.filter(function matches(c) { return c.id === fixture.contentId; }).length > 0;

        if (!foundAfter)
        {
            recordPass(stats, 'fixture content correctly excluded once profile one had already watched it itself');
        }
        else
        {
            recordFail(stats, 'fixture content was still recommended to profile one, even though it already watched it itself');
        }
    }
    else
    {
        recordFail(stats, 'recommendations request (after) failed: ' + (recsAfter ? recsAfter.message : 'no response'));
    }

    console.log('\nSTAGE 5 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [testUser.userId] };
}

// #############################################################################
// #                   STAGE 6 - "WATCHING A MOVIE"                          #
// #############################################################################
// Movies only became watchable once an admin sets their video via
// setMovieVideo (PUT /admin/content/:contentId/movie-video) - this stage
// exercises that end-to-end, since STAGE 4 only ever used the series fixture.

async function stageSixWatchMovie(movieFixture)
{
    console.log('\n========== STAGE 6: WATCHING A MOVIE ==========\n');

    var stats = createStats();
    var testUser = await setupTestUser('watch_movie_');

    var createResult = await createProfile(testUser.token);
    var profileId = createResult.profiles[0].id;

    console.log('Watching the fixture movie with no specific episode (should resolve to its single season 1 / episode 1)');
    var watchResult = await watchMedia(testUser.token, profileId, movieFixture.movieId, null);

    if (watchResult && watchResult.success && watchResult.episode && watchResult.episode.id === movieFixture.episodeId)
    {
        recordPass(stats, 'watching a movie correctly resolved to its single episode');
    }
    else
    {
        recordFail(stats, 'watching a movie did not resolve as expected: ' + JSON.stringify(watchResult));
    }

    console.log('Confirming the movie appears in the profile\'s watch history');
    var detailsResult = await getProfileDetails(testUser.token, profileId);
    var matchingEntry = detailsResult.profile.lastWatched.filter(function matches(entry) { return entry.content_id === movieFixture.movieId; });

    if (matchingEntry.length === 1 && matchingEntry[0].episode_id === movieFixture.episodeId)
    {
        recordPass(stats, 'movie watch correctly persisted in the watch history');
    }
    else
    {
        recordFail(stats, 'movie watch was NOT persisted correctly: ' + JSON.stringify(detailsResult.profile.lastWatched));
    }

    console.log('\nSTAGE 6 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [testUser.userId] };
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== PROFILE ROUTES TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    console.log('Creating fixture series with two episodes...');
    var fixture = await createFixtureSeries();
    console.log('Fixture ready. content_id=' + fixture.contentId + '\n');

    console.log('Creating fixture movie with a video...');
    var movieFixture = await createFixtureMovie();
    console.log('Movie fixture ready. content_id=' + movieFixture.movieId + '\n');

    var stageOneResult = await stageOneProfileCrud();
    var stageTwoResult = await stageTwoProfileOwnership();
    var stageThreeResult = await stageThreeBulkUpdate();
    var stageFourResult = await stageFourLikesAndWatch(fixture);
    var stageFiveResult = await stageFiveRecommendations(fixture);
    var stageSixResult = await stageSixWatchMovie(movieFixture);

    var allUserIds = stageOneResult.userIds
        .concat(stageTwoResult.userIds)
        .concat(stageThreeResult.userIds)
        .concat(stageFourResult.userIds)
        .concat(stageFiveResult.userIds)
        .concat(stageSixResult.userIds);

    console.log('\nCleaning up - deleting ' + allUserIds.length + ' users created during this run\n');

    for (var i = 0; i < allUserIds.length; i++)
    {
        var cleanupResult = await deleteUserAsAdmin(allUserIds[i]);

        if (!cleanupResult || !cleanupResult.success)
        {
            console.log('WARNING - could not delete user with ID: ' + allUserIds[i]);
        }
    }

    console.log('\nDeleting fixture content...');
    var deleteContentResult = await deleteContentAsAdmin(fixture.contentId);

    if (!deleteContentResult || !deleteContentResult.success)
    {
        console.log('WARNING - could not delete fixture content: ' + fixture.contentId);
    }

    var deleteMovieResult = await deleteContentAsAdmin(movieFixture.movieId);

    if (!deleteMovieResult || !deleteMovieResult.success)
    {
        console.log('WARNING - could not delete fixture movie: ' + movieFixture.movieId);
    }

    console.log('\nLogging out admin...');
    var logoutResult = await logoutAdmin(adminToken);

    if (logoutResult && logoutResult.success)
    {
        console.log('Admin logged out successfully.');
    }
    else
    {
        console.log('Could not log out admin: ' + (logoutResult ? logoutResult.message : 'no response'));
    }

    console.log('\n=== ALL STAGES COMPLETED ===');

    console.log('\n========== FINAL RESULTS ==========');
    console.log('STAGE 1 [PROFILE CRUD] complete ' + stageOneResult.stats.passed + '/' + stageOneResult.stats.total);
    console.log('STAGE 2 [PROFILE OWNERSHIP] complete ' + stageTwoResult.stats.passed + '/' + stageTwoResult.stats.total);
    console.log('STAGE 3 [BULK PROFILE UPDATE] complete ' + stageThreeResult.stats.passed + '/' + stageThreeResult.stats.total);
    console.log('STAGE 4 [LIKES & WATCH HISTORY] complete ' + stageFourResult.stats.passed + '/' + stageFourResult.stats.total);
    console.log('STAGE 5 [RECOMMENDATIONS] complete ' + stageFiveResult.stats.passed + '/' + stageFiveResult.stats.total);
    console.log('STAGE 6 [WATCHING A MOVIE] complete ' + stageSixResult.stats.passed + '/' + stageSixResult.stats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});