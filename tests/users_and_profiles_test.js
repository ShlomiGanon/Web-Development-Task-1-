// security_test.js
//
// Classic JavaScript test script that simulates frontend requests against
// the backend API, using the built-in "fetch" and "readline" (no axios or
// other external HTTP libraries).
//
// Coding style requested: Allman braces, named functions only (no anonymous
// or arrow functions), comments in English.
//
// STAGE 1 - "REGISTER & DELETE":
//     Creates users, deletes them as an admin, then verifies that logging in
//     with the deleted user's credentials is no longer possible.
//
// STAGE 2 - "PROFILE HACKING":
//     Creates 3 users, then for every ordered pair (attacker, victim) tries
//     to access the victim's profile using the attacker's token, through
//     GET /profile/get_details/:profileId and GET /profile/get/:profileId.
//     Every attempt is expected to be denied. Cleans up all created users
//     at the end.

'use strict';

var readline = require('readline');

// ==================== CONFIGURATION ====================
// Adjust these values to match your local server setup.

var SERVER_HOST = 'localhost';
var SERVER_PORT = 3000;
var BASE_PATH = '/api';

// If these two are left empty, the script will ask for them interactively
// at startup. If you fill them in here, the script will use them directly
// and skip the interactive prompt.
var ADMIN_EMAIL_OR_PHONE = 'test1@test.com';
var ADMIN_PASSWORD = 'Password123!';

var STAGE1_USER_COUNT = 3;
var STAGE2_USER_COUNT = 3;

// ==================== GLOBAL STATE ====================

var adminToken = null;

// ==================== HTTP HELPER (fetch based) ====================

// Performs a single HTTP request using the built-in "fetch" function.
// Returns { statusCode, data } where data is the parsed JSON body,
// or null if the body could not be parsed as JSON.
async function requestAsync(method, path, body, token)
{
    var url = 'http://' + SERVER_HOST + ':' + SERVER_PORT + BASE_PATH + path;
    var headers = {};
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

// ==================== TEST DATA GENERATION ====================

// Builds a random user payload matching the fields expected by /user/register.
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

// Invalidates the admin token at the end of the run.
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
    var response = await requestAsync('GET', '/user/get', null, token);
    return response.data;
}

// NOTE: the provided user_routes.js defines the delete route as
// "DELETE /user/delete" with no ":user_id" path parameter, while
// admin_controller.deleteUser reads "req.params.user_id". As given, that
// route can never receive a target id. This helper assumes the route is
// meant to be "DELETE /user/delete/:user_id" - update SERVER routing to
// match, or adjust this function, before running the script.
async function deleteUserAsAdmin(targetUserId)
{
    var response = await requestAsync('DELETE', '/user/delete/' + targetUserId, null, adminToken);
    return response.data;
}

async function getOwnProfiles(token)
{
    var response = await requestAsync('GET', '/profile/get', null, token);
    return response.data;
}

// Explicitly creates a profile for the given user. Needed because
// /user/register does not appear to create a default profile in practice.
async function createProfile(token)
{
    var response = await requestAsync('POST', '/profile/create', null, token);
    return response.data;
}

// ==================== RESULT LOGGING HELPERS ====================

// Creates a fresh pass/total counter object for a stage.
function createStats()
{
    return { passed: 0, total: 0 };
}

// Logs a PASS line and updates the stage's counters.
function recordPass(stats, message)
{
    stats.passed = stats.passed + 1;
    stats.total = stats.total + 1;
    console.log('PASS - ' + message);
}

// Logs a FAIL line and updates the stage's counters.
function recordFail(stats, message)
{
    stats.total = stats.total + 1;
    console.log('FAIL - ' + message);
}

// Expects data.success === false. Used for endpoints that must deny access.
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

// ==================== STAGE 1: REGISTER & DELETE ====================

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

// ==================== STAGE 2: PROFILE HACKING ====================

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

    // Try every ordered pair (attacker, victim) where attacker != victim
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

            var getDetailsResponse = await requestAsync('GET', '/profile/get_details/' + victim.profileId, null, attacker.token);
            checkAccessDenied(stats, 'get_details', getDetailsResponse.data);

            var getProfileResponse = await requestAsync('GET', '/profile/get/' + victim.profileId, null, attacker.token);
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

// ==================== MAIN ====================

// Returns the admin credentials to use for the whole run.
// If ADMIN_EMAIL_OR_PHONE / ADMIN_PASSWORD are already configured above,
// they are used as-is. Otherwise the user is asked for them interactively.
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

async function main()
{
    console.log('=== BACKEND SECURITY TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    var stageOneStats = await stageOneRegisterAndDelete();
    var stageTwoStats = await stageTwoProfileHacking();

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
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});