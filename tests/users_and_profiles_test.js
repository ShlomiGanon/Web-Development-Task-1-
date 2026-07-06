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
var ADMIN_EMAIL_OR_PHONE = 'test1@test.com';
var ADMIN_PASSWORD = 'Password123!';

var STAGE1_USER_COUNT = 3;
var STAGE2_USER_COUNT = 3;
var STAGE3_USER_COUNT = 2;

// Real content _id needed for STAGE 3 like/watch checks (no endpoint to list
// content). Leave empty to skip those checks; profile update still runs.
var TEST_CONTENT_ID = '';

// ==================== GLOBAL STATE ====================

var adminToken = null;

// ==================== HTTP HELPER (fetch based) ====================

// Sends one HTTP request via fetch. Returns { statusCode, data } (data is
// the parsed JSON body, or null if parsing failed).
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

// Returns admin credentials: from config if set, otherwise asks interactively.
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

// Builds a random user payload for /user/register.
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

// ==================== SHARED API WRAPPER FUNCTIONS ====================
// Used by multiple stages and by MAIN for admin auth.

async function loginAdmin(email, password)
{
    var response = await requestAsync('POST', '/user/login', { email_or_phone: email, password: password }, null);

    if (!response.data || !response.data.success)
    {
        throw new Error('Admin login failed: ' + (response.data ? response.data.message : 'no response from server'));
    }

    return response.data.token;
}

// Invalidates the admin token.
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

// Route renamed: GET /user/get -> GET /user/me
async function getUserInfo(token)
{
    var response = await requestAsync('GET', '/user/me', null, token);
    return response.data;
}

// Route renamed: DELETE /user/delete/:user_id -> DELETE /user/:user_id
async function deleteUserAsAdmin(targetUserId)
{
    var response = await requestAsync('DELETE', '/user/' + targetUserId, null, adminToken);
    return response.data;
}

// Route renamed: GET /profile/get_details/:profileId -> GET /profile/:profileId/details
// Fetches the full profile document, used to verify persisted changes.
async function getProfileDetails(token, profileId)
{
    var response = await requestAsync('GET', '/profile/' + profileId + '/details', null, token);
    return response.data;
}

// ==================== SHARED RESULT LOGGING HELPERS ====================

// Creates a fresh pass/total counter.
function createStats()
{
    return { passed: 0, total: 0 };
}

// Logs PASS and updates counters.
function recordPass(stats, message)
{
    stats.passed = stats.passed + 1;
    stats.total = stats.total + 1;
    console.log('PASS - ' + message);
}

// Logs FAIL and updates counters.
function recordFail(stats, message)
{
    stats.total = stats.total + 1;
    console.log('FAIL - ' + message);
}

// #############################################################################
// #                    STAGE 1 - "REGISTER & DELETE"                        #
// #############################################################################

async function stageOneRegisterAndDelete()
{
    console.log('\n========== STAGE 1: REGISTER & DELETE ==========\n');

    var stats = createStats();

    for (var i = 0; i < STAGE1_USER_COUNT; i++)
    {
        var userData = generateRandomUser('stage1_user' + i + '_');

        console.log('Registering user: ' + userData.email);
        var registerResult = await registerUser(userData);

        if (!registerResult || !registerResult.success)
        {
            recordFail(stats, 'could not register user: ' + (registerResult ? registerResult.message : 'no response'));
            continue;
        }

        console.log('Logging in as the new user to retrieve its ID');
        var loginResult = await loginUser(userData);

        if (!loginResult || !loginResult.success)
        {
            recordFail(stats, 'could not login as newly registered user');
            continue;
        }

        var userToken = loginResult.token;
        var userInfoResult = await getUserInfo(userToken);

        if (!userInfoResult || !userInfoResult.success)
        {
            recordFail(stats, 'could not retrieve user info for newly registered user');
            continue;
        }

        var targetUserId = userInfoResult.user.id;

        console.log('Deleting user with ID: ' + targetUserId);
        var deleteResult = await deleteUserAsAdmin(targetUserId);

        if (!deleteResult || !deleteResult.success)
        {
            recordFail(stats, 'could not delete user: ' + (deleteResult ? deleteResult.message : 'no response'));
            continue;
        }

        console.log('Attempting to login with the deleted user credentials (should fail)');
        var loginAfterDeleteResult = await loginUser(userData);

        if (loginAfterDeleteResult && loginAfterDeleteResult.success === false)
        {
            recordPass(stats, 'login correctly denied after deletion. Message: ' + loginAfterDeleteResult.message);
        }
        else
        {
            recordFail(stats, 'login succeeded after deletion, this should not happen!');
        }
    }

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #                    STAGE 2 - "PROFILE HACKING"                          #
// #############################################################################

// Route renamed: POST /profile/create -> POST /profile
// Creates a profile for the user. /user/register does not create one.
async function createProfile(token)
{
    var response = await requestAsync('POST', '/profile', null, token);
    return response.data;
}

// Expects success === false - used where access should be denied.
function checkAccessDenied(stats, endpointName, data)
{
    if (data && data.success === false)
    {
        recordPass(stats, '[' + endpointName + '] access correctly denied. Message: ' + data.message);
    }
    else
    {
        recordFail(stats, '[' + endpointName + '] access was NOT denied - this is a security issue!');
    }
}

async function stageTwoProfileHacking()
{
    console.log('\n========== STAGE 2: PROFILE HACKING ==========\n');

    var stats = createStats();
    var users = [];

    for (var i = 0; i < STAGE2_USER_COUNT; i++)
    {
        var userData = generateRandomUser('stage2_user' + i + '_');

        console.log('Registering user: ' + userData.email);
        var registerResult = await registerUser(userData);

        if (!registerResult || !registerResult.success)
        {
            recordFail(stats, 'could not register user: ' + (registerResult ? registerResult.message : 'no response'));
            continue;
        }

        var loginResult = await loginUser(userData);

        if (!loginResult || !loginResult.success)
        {
            recordFail(stats, 'could not login as newly registered user');
            continue;
        }

        var token = loginResult.token;
        var userInfoResult = await getUserInfo(token);

        if (!userInfoResult || !userInfoResult.success)
        {
            recordFail(stats, 'could not retrieve user info for newly registered user');
            continue;
        }

        var profilesResult = await createProfile(token);

        if (!profilesResult || !profilesResult.success || !profilesResult.profiles || profilesResult.profiles.length === 0)
        {
            recordFail(stats, 'could not create profile for user: ' + userData.email + '. Server message: ' + (profilesResult ? profilesResult.message : 'no response'));
            continue;
        }

        var profileId = profilesResult.profiles[0].id;

        users.push(
        {
            userData: userData,
            userId: userInfoResult.user.id,
            token: token,
            profileId: profileId
        });
    }

    console.log('\nCreated ' + users.length + ' users for cross-access testing\n');

    // Every ordered pair (attacker, victim) where attacker != victim
    for (var a = 0; a < users.length; a++)
    {
        for (var v = 0; v < users.length; v++)
        {
            if (a === v)
            {
                continue;
            }

            var attacker = users[a];
            var victim = users[v];

            console.log('User ' + attacker.userData.email + ' attempting to access profile of ' + victim.userData.email);

            // Route renamed: GET /profile/get_details/:profileId -> GET /profile/:profileId/details
            var getDetailsResponse = await requestAsync('GET', '/profile/' + victim.profileId + '/details', null, attacker.token);
            checkAccessDenied(stats, 'get_details', getDetailsResponse.data);

            // Route renamed: GET /profile/get/:profileId -> GET /profile/:profileId
            var getProfileResponse = await requestAsync('GET', '/profile/' + victim.profileId, null, attacker.token);
            checkAccessDenied(stats, 'get', getProfileResponse.data);
        }
    }

    console.log('\nCleaning up - deleting all users created in stage 2\n');

    for (var c = 0; c < users.length; c++)
    {
        var cleanupResult = await deleteUserAsAdmin(users[c].userId);

        if (cleanupResult && cleanupResult.success)
        {
            console.log('Deleted user: ' + users[c].userData.email);
        }
        else
        {
            recordFail(stats, 'could not delete user: ' + users[c].userData.email);
        }
    }

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #                STAGE 3 - "PROFILE DATA OPERATIONS"                      #
// #############################################################################
// Updates profile fields, adds and removes a profile, and (if TEST_CONTENT_ID
// is set) toggles a like and updates watch history - re-fetching after each
// change to confirm it actually persisted on the server.

// Route renamed: PUT /profile/update/:profileId -> PUT /profile/:profileId
async function updateProfileRequest(token, profileId, changes)
{
    var response = await requestAsync('PUT', '/profile/' + profileId, changes, token);
    return response.data;
}

// Route renamed: DELETE /profile/delete/:profileId -> DELETE /profile/:profileId
async function deleteProfileRequest(token, profileId)
{
    var response = await requestAsync('DELETE', '/profile/' + profileId, null, token);
    return response.data;
}

// Route renamed: POST /profile/press_like/:profileId/:mediaId -> POST /profile/:profileId/likes/:contentId
async function pressLikeRequest(token, profileId, contentId)
{
    var response = await requestAsync('POST', '/profile/' + profileId + '/likes/' + contentId, null, token);
    return response.data;
}

// Route renamed: POST /profile/watch/:profileId/:mediaId -> POST /profile/:profileId/watch/:contentId
async function watchMediaRequest(token, profileId, contentId)
{
    var response = await requestAsync('POST', '/profile/' + profileId + '/watch/' + contentId, null, token);
    return response.data;
}

// Checks that an update response reflects the expected values.
function checkProfileSummaryMatches(stats, label, profileSummary, expected)
{
    if (!profileSummary)
    {
        recordFail(stats, label + ' - profile summary was not returned');
        return;
    }

    var matches = profileSummary.profileName === expected.profileName &&
        profileSummary.age === expected.age &&
        profileSummary.ImageName === expected.ImageName;

    if (matches)
    {
        recordPass(stats, label + ' - update response reflects the new values');
    }
    else
    {
        recordFail(stats, label + ' - update response does not reflect the new values. Got: ' + JSON.stringify(profileSummary));
    }
}

// Re-fetches the profile to confirm the values were actually persisted.
async function checkProfilePersisted(stats, label, token, profileId, expected)
{
    var detailsResult = await getProfileDetails(token, profileId);

    if (!detailsResult || !detailsResult.success || !detailsResult.profile)
    {
        recordFail(stats, label + ' - could not re-fetch profile to verify persistence');
        return;
    }

    var profile = detailsResult.profile;
    var matches = profile.profileName === expected.profileName &&
        profile.age === expected.age &&
        profile.ImageName === expected.ImageName;

    if (matches)
    {
        recordPass(stats, label + ' - change persisted correctly on the server');
    }
    else
    {
        recordFail(stats, label + ' - change was NOT persisted on the server. Got: profileName=' + profile.profileName + ', age=' + profile.age + ', ImageName=' + profile.ImageName);
    }
}

// Updates a profile, checks the response, then confirms it persisted.
async function testProfileUpdate(stats, token, profileId)
{
    var randomNumber = Math.floor(Math.random() * 1000000);
    var expected =
    {
        profileName: 'Updated' + randomNumber,
        age: 18 + Math.floor(Math.random() * 50),
        ImageName: 'image_' + randomNumber + '.png'
    };

    console.log('Updating profile ' + profileId + ' with new values: ' + JSON.stringify(expected));

    var updateResult = await updateProfileRequest(token, profileId, expected);

    if (!updateResult || !updateResult.success)
    {
        recordFail(stats, 'update request failed: ' + (updateResult ? updateResult.message : 'no response'));
        return;
    }

    var updatedSummary = null;

    for (var i = 0; i < updateResult.profiles.length; i++)
    {
        if (updateResult.profiles[i].id === profileId)
        {
            updatedSummary = updateResult.profiles[i];
        }
    }

    checkProfileSummaryMatches(stats, 'Update response', updatedSummary, expected);
    await checkProfilePersisted(stats, 'Update persistence', token, profileId, expected);
}

// Adds a second profile for the user, then deletes it, checking after each
// step that the profile list on the server actually reflects the change.
// Compares the profile list before/after instead of assuming exact counts,
// in case more than one profile is unexpectedly created (see NOTE below).
async function testProfileAddAndRemove(stats, token)
{
    // Route renamed: GET /profile/get -> GET /profile
    var beforeResponse = await requestAsync('GET', '/profile', null, token);

    if (!beforeResponse.data || !beforeResponse.data.success)
    {
        recordFail(stats, 'add profile - could not read the profile list before adding');
        return;
    }

    var beforeIds = beforeResponse.data.profiles.map(function toId(profile)
    {
        return profile.id;
    });

    console.log('Adding a second profile');
    var createResult = await createProfile(token);

    if (!createResult || !createResult.success || !createResult.profiles)
    {
        recordFail(stats, 'add profile - request failed: ' + (createResult ? createResult.message : 'no response'));
        return;
    }

    var newProfileIds = [];

    for (var i = 0; i < createResult.profiles.length; i++)
    {
        var currentId = createResult.profiles[i].id;

        if (beforeIds.indexOf(currentId) === -1)
        {
            newProfileIds.push(currentId);
        }
    }

    // NOTE: a single POST /profile request is expected to add exactly
    // one profile. If more than one shows up here, it points to a duplicate
    // request reaching the server (for example a stale keep-alive connection
    // being reused) rather than a problem with this check.
    if (newProfileIds.length === 1)
    {
        recordPass(stats, 'add profile - server added exactly 1 new profile');
    }
    else
    {
        recordFail(stats, 'add profile - expected 1 new profile, server added ' + newProfileIds.length + ': ' + JSON.stringify(newProfileIds));
    }

    console.log('Removing the ' + newProfileIds.length + ' new profile(s)');

    for (var j = 0; j < newProfileIds.length; j++)
    {
        var deleteResult = await deleteProfileRequest(token, newProfileIds[j]);

        if (!deleteResult || !deleteResult.success)
        {
            recordFail(stats, 'remove profile - request failed for ' + newProfileIds[j] + ': ' + (deleteResult ? deleteResult.message : 'no response'));
        }
    }

    // Route renamed: GET /profile/get -> GET /profile
    var afterResponse = await requestAsync('GET', '/profile', null, token);
    var stillPresent = [];

    if (afterResponse.data && afterResponse.data.success)
    {
        for (var k = 0; k < newProfileIds.length; k++)
        {
            var afterIds = afterResponse.data.profiles.map(function toId(profile)
            {
                return profile.id;
            });

            if (afterIds.indexOf(newProfileIds[k]) !== -1)
            {
                stillPresent.push(newProfileIds[k]);
            }
        }
    }
    else
    {
        recordFail(stats, 'remove profile - could not read the profile list after removing');
        return;
    }

    if (stillPresent.length === 0)
    {
        recordPass(stats, 'remove profile - persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'remove profile - was NOT persisted on the server for: ' + JSON.stringify(stillPresent));
    }
}

// Adds then removes a like, confirming persistence after each step.
async function testProfileLikeToggle(stats, token, profileId)
{
    console.log('Adding a like for content ' + TEST_CONTENT_ID);
    var likeResult = await pressLikeRequest(token, profileId, TEST_CONTENT_ID);

    if (likeResult && likeResult.success && likeResult.liked === true && likeResult.likedMediaIds.indexOf(TEST_CONTENT_ID) !== -1)
    {
        recordPass(stats, 'like response confirms content was added');
    }
    else
    {
        recordFail(stats, 'like response did not confirm content was added: ' + (likeResult ? likeResult.message : 'no response'));
    }

    var detailsAfterLike = await getProfileDetails(token, profileId);

    if (detailsAfterLike && detailsAfterLike.success && detailsAfterLike.profile && detailsAfterLike.profile.Liked_Media_IDs.indexOf(TEST_CONTENT_ID) !== -1)
    {
        recordPass(stats, 'like persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'like was NOT persisted on the server');
    }

    console.log('Removing the like for content ' + TEST_CONTENT_ID);
    var unlikeResult = await pressLikeRequest(token, profileId, TEST_CONTENT_ID);

    if (unlikeResult && unlikeResult.success && unlikeResult.liked === false && unlikeResult.likedMediaIds.indexOf(TEST_CONTENT_ID) === -1)
    {
        recordPass(stats, 'unlike response confirms content was removed');
    }
    else
    {
        recordFail(stats, 'unlike response did not confirm content was removed: ' + (unlikeResult ? unlikeResult.message : 'no response'));
    }

    var detailsAfterUnlike = await getProfileDetails(token, profileId);

    if (detailsAfterUnlike && detailsAfterUnlike.success && detailsAfterUnlike.profile && detailsAfterUnlike.profile.Liked_Media_IDs.indexOf(TEST_CONTENT_ID) === -1)
    {
        recordPass(stats, 'unlike persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'unlike was NOT persisted on the server');
    }
}

// Records a watch, confirming persistence.
async function testProfileWatchHistory(stats, token, profileId)
{
    console.log('Recording a watch for content ' + TEST_CONTENT_ID);
    var watchResult = await watchMediaRequest(token, profileId, TEST_CONTENT_ID);

    if (watchResult && watchResult.success && watchResult.watchHistory.length > 0 && watchResult.watchHistory[0] === TEST_CONTENT_ID)
    {
        recordPass(stats, 'watch response confirms content is at the front of the history');
    }
    else
    {
        recordFail(stats, 'watch response did not confirm the update: ' + (watchResult ? watchResult.message : 'no response'));
    }

    var detailsAfterWatch = await getProfileDetails(token, profileId);

    if (detailsAfterWatch && detailsAfterWatch.success && detailsAfterWatch.profile && detailsAfterWatch.profile.LastWatched_Media_IDs.length > 0 && detailsAfterWatch.profile.LastWatched_Media_IDs[0] === TEST_CONTENT_ID)
    {
        recordPass(stats, 'watch history persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'watch history was NOT persisted on the server');
    }
}

async function stageThreeProfileDataOperations()
{
    console.log('\n========== STAGE 3: PROFILE DATA OPERATIONS ==========\n');

    var stats = createStats();
    var isContentConfigured = TEST_CONTENT_ID !== null && TEST_CONTENT_ID !== undefined && TEST_CONTENT_ID.length > 0;

    if (!isContentConfigured)
    {
        console.log('TEST_CONTENT_ID is not configured - like and watch checks will be skipped.\n');
    }

    var userIds = [];

    for (var i = 0; i < STAGE3_USER_COUNT; i++)
    {
        var userData = generateRandomUser('stage3_user' + i + '_');

        console.log('Registering user: ' + userData.email);
        var registerResult = await registerUser(userData);

        if (!registerResult || !registerResult.success)
        {
            recordFail(stats, 'could not register user: ' + (registerResult ? registerResult.message : 'no response'));
            continue;
        }

        var loginResult = await loginUser(userData);

        if (!loginResult || !loginResult.success)
        {
            recordFail(stats, 'could not login as newly registered user');
            continue;
        }

        var token = loginResult.token;
        var userInfoResult = await getUserInfo(token);

        if (!userInfoResult || !userInfoResult.success)
        {
            recordFail(stats, 'could not retrieve user info for newly registered user');
            continue;
        }

        var profilesResult = await createProfile(token);

        if (!profilesResult || !profilesResult.success || !profilesResult.profiles || profilesResult.profiles.length === 0)
        {
            recordFail(stats, 'could not create profile for user: ' + userData.email + '. Server message: ' + (profilesResult ? profilesResult.message : 'no response'));
            continue;
        }

        var profileId = profilesResult.profiles[0].id;

        userIds.push(userInfoResult.user.id);

        await testProfileUpdate(stats, token, profileId);
        await testProfileAddAndRemove(stats, token);

        if (isContentConfigured)
        {
            await testProfileLikeToggle(stats, token, profileId);
            await testProfileWatchHistory(stats, token, profileId);
        }
    }

    console.log('\nCleaning up - deleting all users created in stage 3\n');

    for (var c = 0; c < userIds.length; c++)
    {
        var cleanupResult = await deleteUserAsAdmin(userIds[c]);

        if (!cleanupResult || !cleanupResult.success)
        {
            recordFail(stats, 'could not delete user with ID: ' + userIds[c]);
        }
    }

    console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== BACKEND SECURITY TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    var stageOneStats = await stageOneRegisterAndDelete();
    var stageTwoStats = await stageTwoProfileHacking();
    var stageThreeStats = await stageThreeProfileDataOperations();

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
    console.log('STAGE 1 [REGISTER & DELETE] complete ' + stageOneStats.passed + '/' + stageOneStats.total);
    console.log('STAGE 2 [PROFILE HACKING] complete ' + stageTwoStats.passed + '/' + stageTwoStats.total);
    console.log('STAGE 3 [PROFILE DATA OPERATIONS] complete ' + stageThreeStats.passed + '/' + stageThreeStats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});