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
// NOTE: deleting a user (used for cleanup here) requires SUPER_ADMIN permission level.
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

async function loginUser(emailOrPhone, password)
{
    var response = await requestAsync('POST', '/user/login', { email_or_phone: emailOrPhone, password: password }, null);
    return response.data;
}

async function logoutUser(token)
{
    var response = await requestAsync('POST', '/user/logout', null, token);
    return response.data;
}

async function getUserInfo(token)
{
    var response = await requestAsync('GET', '/user/me', null, token);
    return response.data;
}

async function updateUserInfo(token, changes)
{
    var response = await requestAsync('PUT', '/user/me', changes, token);
    return response.data;
}

// Admin route lives under /api/admin/users/:user_id now.
async function deleteUserAsAdmin(targetUserId)
{
    var response = await requestAsync('DELETE', '/admin/users/' + targetUserId, null, adminToken);
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

// #############################################################################
// #              STAGE 1 - "REGISTRATION VALIDATION"                        #
// #############################################################################

async function stageOneRegistrationValidation()
{
    console.log('\n========== STAGE 1: REGISTRATION VALIDATION ==========\n');

    var stats = createStats();
    var createdUserIds = [];

    var baseUser = generateRandomUser('reg_valid_');

    console.log('Registering a valid user: ' + baseUser.email);
    var validResult = await registerUser(baseUser);

    if (validResult && validResult.success)
    {
        recordPass(stats, 'valid registration succeeded');
    }
    else
    {
        recordFail(stats, 'valid registration failed unexpectedly: ' + (validResult ? validResult.message : 'no response'));
        console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, createdUserIds: createdUserIds };
    }

    // Fetch the ID so we can clean this user up later.
    var loginResult = await loginUser(baseUser.email, baseUser.password);

    if (loginResult && loginResult.success)
    {
        var infoResult = await getUserInfo(loginResult.token);

        if (infoResult && infoResult.success)
        {
            createdUserIds.push(infoResult.user.id);
        }
    }

    console.log('Attempting to register again with the same email (should fail)');
    var duplicateEmailUser = generateRandomUser('reg_dup_email_');
    duplicateEmailUser.email = baseUser.email;
    var duplicateEmailResult = await registerUser(duplicateEmailUser);
    checkFailed(stats, 'duplicate email registration', duplicateEmailResult, 'Email already exists');

    console.log('Attempting to register again with the same phone (should fail)');
    var duplicatePhoneUser = generateRandomUser('reg_dup_phone_');
    duplicatePhoneUser.phone = baseUser.phone;
    var duplicatePhoneResult = await registerUser(duplicatePhoneUser);
    checkFailed(stats, 'duplicate phone registration', duplicatePhoneResult, 'Phone number already exists');

    console.log('Attempting to register with an invalid email (should fail)');
    var invalidEmailUser = generateRandomUser('reg_bademail_');
    invalidEmailUser.email = 'not-an-email';
    var invalidEmailResult = await registerUser(invalidEmailUser);
    checkFailed(stats, 'invalid email registration', invalidEmailResult, null);

    console.log('Attempting to register with an invalid phone (should fail)');
    var invalidPhoneUser = generateRandomUser('reg_badphone_');
    invalidPhoneUser.phone = '123';
    var invalidPhoneResult = await registerUser(invalidPhoneUser);
    checkFailed(stats, 'invalid phone registration', invalidPhoneResult, null);

    console.log('Attempting to register with a weak password (should fail)');
    var invalidPasswordUser = generateRandomUser('reg_badpass_');
    invalidPasswordUser.password = '123';
    var invalidPasswordResult = await registerUser(invalidPasswordUser);
    checkFailed(stats, 'weak password registration', invalidPasswordResult, null);

    console.log('Attempting to register with only a single-word full name (should fail)');
    var invalidNameUser = generateRandomUser('reg_badname_');
    invalidNameUser.fullName = 'OnlyOneName';
    var invalidNameResult = await registerUser(invalidNameUser);
    checkFailed(stats, 'single-word full name registration', invalidNameResult, 'Invalid full name');

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, createdUserIds: createdUserIds };
}

// #############################################################################
// #                 STAGE 2 - "LOGIN & SESSION"                             #
// #############################################################################

async function stageTwoLoginAndSession()
{
    console.log('\n========== STAGE 2: LOGIN & SESSION ==========\n');

    var stats = createStats();
    var createdUserIds = [];

    var userData = generateRandomUser('login_test_');

    console.log('Registering user: ' + userData.email);
    var registerResult = await registerUser(userData);

    if (!registerResult || !registerResult.success)
    {
        recordFail(stats, 'could not register user for this stage: ' + (registerResult ? registerResult.message : 'no response'));
        console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, createdUserIds: createdUserIds };
    }

    console.log('Logging in with email');
    var loginByEmail = await loginUser(userData.email, userData.password);

    if (loginByEmail && loginByEmail.success && loginByEmail.token)
    {
        recordPass(stats, 'login by email succeeded and returned a token');
    }
    else
    {
        recordFail(stats, 'login by email failed: ' + (loginByEmail ? loginByEmail.message : 'no response'));
    }

    console.log('Logging in with phone');
    var loginByPhone = await loginUser(userData.phone, userData.password);

    if (loginByPhone && loginByPhone.success && loginByPhone.token)
    {
        recordPass(stats, 'login by phone succeeded and returned a token');
    }
    else
    {
        recordFail(stats, 'login by phone failed: ' + (loginByPhone ? loginByPhone.message : 'no response'));
    }

    console.log('Attempting login with the wrong password (should fail)');
    var wrongPasswordResult = await loginUser(userData.email, 'WrongPassword999!');
    checkFailed(stats, 'wrong password login', wrongPasswordResult, 'Invalid password');

    console.log('Attempting login with a non-existent account (should fail)');
    var nonExistentResult = await loginUser('nobody_' + Math.random() + '@example.com', 'Whatever123!');
    checkFailed(stats, 'non-existent account login', nonExistentResult, 'User not found');

    var token = loginByEmail && loginByEmail.token ? loginByEmail.token : null;

    if (!token)
    {
        recordFail(stats, 'no valid token available - skipping remaining checks in this stage');
        console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, createdUserIds: createdUserIds };
    }

    var infoResult = await getUserInfo(token);

    if (infoResult && infoResult.success)
    {
        createdUserIds.push(infoResult.user.id);
    }

    console.log('Calling GET /user/me with no token at all (should fail)');
    var noTokenResult = await getUserInfo(null);
    checkFailed(stats, 'GET /user/me without a token', noTokenResult, null);

    console.log('Calling GET /user/me with a valid token');
    if (infoResult && infoResult.success && infoResult.user.email === userData.email)
    {
        recordPass(stats, 'GET /user/me returned the correct user data');
    }
    else
    {
        recordFail(stats, 'GET /user/me did not return the expected user data: ' + JSON.stringify(infoResult));
    }

    console.log('Logging out');
    var logoutResult = await logoutUser(token);

    if (logoutResult && logoutResult.success)
    {
        recordPass(stats, 'logout succeeded');
    }
    else
    {
        recordFail(stats, 'logout failed: ' + (logoutResult ? logoutResult.message : 'no response'));
    }

    console.log('Calling GET /user/me again with the now-invalidated token (should fail)');
    var afterLogoutResult = await getUserInfo(token);
    checkFailed(stats, 'GET /user/me with invalidated token', afterLogoutResult, null);

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, createdUserIds: createdUserIds };
}

// #############################################################################
// #                  STAGE 3 - "UPDATE ACCOUNT DETAILS"                     #
// #############################################################################

async function stageThreeUpdateAccount()
{
    console.log('\n========== STAGE 3: UPDATE ACCOUNT DETAILS ==========\n');

    var stats = createStats();
    var createdUserIds = [];

    var userAData = generateRandomUser('update_a_');
    var userBData = generateRandomUser('update_b_');

    console.log('Registering two users: ' + userAData.email + ' and ' + userBData.email);
    var registerA = await registerUser(userAData);
    var registerB = await registerUser(userBData);

    if (!registerA || !registerA.success || !registerB || !registerB.success)
    {
        recordFail(stats, 'could not register users for this stage');
        console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, createdUserIds: createdUserIds };
    }

    var loginA = await loginUser(userAData.email, userAData.password);
    var tokenA = loginA.token;
    var infoA = await getUserInfo(tokenA);
    createdUserIds.push(infoA.user.id);

    var loginB = await loginUser(userBData.email, userBData.password);
    var infoB = await getUserInfo(loginB.token);
    createdUserIds.push(infoB.user.id);

    console.log('Updating user A\'s full name');
    var newFullName = 'Updated Name';
    var updateResult = await updateUserInfo(tokenA, { fullName: newFullName });

    if (updateResult && updateResult.success && updateResult.user.fullName === newFullName)
    {
        recordPass(stats, 'update response reflects the new full name');
    }
    else
    {
        recordFail(stats, 'update response does not reflect the new full name: ' + JSON.stringify(updateResult));
    }

    console.log('Re-fetching user A to confirm the change persisted');
    var afterUpdateInfo = await getUserInfo(tokenA);

    if (afterUpdateInfo && afterUpdateInfo.success && afterUpdateInfo.user.fullName === newFullName)
    {
        recordPass(stats, 'full name change persisted correctly on the server');
    }
    else
    {
        recordFail(stats, 'full name change was NOT persisted: ' + JSON.stringify(afterUpdateInfo));
    }

    console.log('Attempting to update user A\'s email to user B\'s email (should fail)');
    var duplicateEmailUpdate = await updateUserInfo(tokenA, { email: userBData.email });
    checkFailed(stats, 'update to a duplicate email', duplicateEmailUpdate, 'already exists');

    console.log('Attempting to update with no changes at all (should fail)');
    var noChangesUpdate = await updateUserInfo(tokenA, {});
    checkFailed(stats, 'update with no changes', noChangesUpdate, 'No changes to update');

    console.log('Attempting to update with an invalid new password (should fail)');
    var invalidPasswordUpdate = await updateUserInfo(tokenA, { password: '1' });
    checkFailed(stats, 'update with invalid password', invalidPasswordUpdate, 'Invalid password');

    console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, createdUserIds: createdUserIds };
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== USER ROUTES TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    var stageOneResult = await stageOneRegistrationValidation();
    var stageTwoResult = await stageTwoLoginAndSession();
    var stageThreeResult = await stageThreeUpdateAccount();

    var allCreatedUserIds = stageOneResult.createdUserIds
        .concat(stageTwoResult.createdUserIds)
        .concat(stageThreeResult.createdUserIds);

    console.log('\nCleaning up - deleting ' + allCreatedUserIds.length + ' users created during this run\n');

    for (var i = 0; i < allCreatedUserIds.length; i++)
    {
        var cleanupResult = await deleteUserAsAdmin(allCreatedUserIds[i]);

        if (!cleanupResult || !cleanupResult.success)
        {
            console.log('WARNING - could not delete user with ID: ' + allCreatedUserIds[i]);
        }
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
    console.log('STAGE 1 [REGISTRATION VALIDATION] complete ' + stageOneResult.stats.passed + '/' + stageOneResult.stats.total);
    console.log('STAGE 2 [LOGIN & SESSION] complete ' + stageTwoResult.stats.passed + '/' + stageTwoResult.stats.total);
    console.log('STAGE 3 [UPDATE ACCOUNT DETAILS] complete ' + stageThreeResult.stats.passed + '/' + stageThreeResult.stats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});