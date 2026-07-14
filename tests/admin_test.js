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
// NOTE: this script assumes the configured account has SUPER_ADMIN permission
// level, since it is used to delete users and to test the super-admin-only
// delete-user endpoint directly.
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

// --- Admin: user management ---

async function searchUsersAsAdmin(token, queryString)
{
    var response = await requestAsync('GET', '/admin/users?' + queryString, null, token);
    return response.data;
}

async function getUserAsAdmin(token, userId)
{
    var response = await requestAsync('GET', '/admin/users/' + userId, null, token);
    return response.data;
}

async function updateUserAsAdmin(token, userId, changes)
{
    var response = await requestAsync('PUT', '/admin/users/' + userId, changes, token);
    return response.data;
}

async function deleteUserAsAdmin(token, userId)
{
    var response = await requestAsync('DELETE', '/admin/users/' + userId, null, token);
    return response.data;
}

async function setPermissionAsAdmin(token, userId, permissionLevel)
{
    var response = await requestAsync('PUT', '/admin/users/' + userId + '/permission', { permission_level: permissionLevel }, token);
    return response.data;
}

async function getTokensCountAsAdmin(token, userId)
{
    var response = await requestAsync('GET', '/admin/users/' + userId + '/tokens_count', null, token);
    return response.data;
}

async function kickUserAsAdmin(token, userId)
{
    var response = await requestAsync('POST', '/admin/users/' + userId + '/kick', null, token);
    return response.data;
}

async function banUserAsAdmin(token, userId, hoursToBan)
{
    var response = await requestAsync('POST', '/admin/users/' + userId + '/ban', { hours_to_ban: hoursToBan }, token);
    return response.data;
}

async function checkBanStatusAsAdmin(token, userId)
{
    var response = await requestAsync('GET', '/admin/users/' + userId + '/ban', null, token);
    return response.data;
}

// --- Admin: content management ---

async function createContentAsAdmin(token, payload)
{
    var response = await requestAsync('POST', '/admin/content', payload, token);
    return response.data;
}

async function updateContentAsAdmin(token, contentId, changes)
{
    var response = await requestAsync('PUT', '/admin/content/' + contentId, changes, token);
    return response.data;
}

async function deleteContentAsAdmin(token, contentId)
{
    var response = await requestAsync('DELETE', '/admin/content/' + contentId, null, token);
    return response.data;
}

async function addEpisodeAsAdmin(token, contentId, payload)
{
    var response = await requestAsync('POST', '/admin/content/' + contentId + '/episodes', payload, token);
    return response.data;
}

async function updateEpisodeAsAdmin(token, contentId, episodeId, changes)
{
    var response = await requestAsync('PUT', '/admin/content/' + contentId + '/episodes/' + episodeId, changes, token);
    return response.data;
}

async function removeEpisodeAsAdmin(token, contentId, episodeId)
{
    var response = await requestAsync('DELETE', '/admin/content/' + contentId + '/episodes/' + episodeId, null, token);
    return response.data;
}

async function setMovieVideoAsAdmin(token, contentId, payload)
{
    var response = await requestAsync('PUT', '/admin/content/' + contentId + '/movie-video', payload, token);
    return response.data;
}

// --- Public content routes, used to verify admin actions actually took effect ---

async function getContentPublic(contentId)
{
    var response = await requestAsync('GET', '/content/' + contentId, null, null);
    return response.data;
}

async function getEpisodePublic(contentId, episodeId)
{
    var response = await requestAsync('GET', '/content/' + contentId + '/episodes/' + episodeId, null, null);
    return response.data;
}

// --- Admin: review management ---

async function adminUpdateReview(token, reviewId, changes)
{
    var response = await requestAsync('PUT', '/admin/reviews/' + reviewId, changes, token);
    return response.data;
}

async function adminRemoveReview(token, reviewId)
{
    var response = await requestAsync('DELETE', '/admin/reviews/' + reviewId, null, token);
    return response.data;
}

// --- Non-admin helpers, used for the profile+review fixture in stage 3 ---

async function createProfile(token)
{
    var response = await requestAsync('POST', '/profile', null, token);
    return response.data;
}

async function addReview(token, profileId, contentId, episodeId, body)
{
    var response = await requestAsync('POST', '/reviews/' + profileId + '/' + contentId + '/' + episodeId, body, token);
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
// #                  STAGE 1 - "USER ADMINISTRATION"                        #
// #############################################################################

async function stageOneUserAdmin()
{
    console.log('\n========== STAGE 1: USER ADMINISTRATION ==========\n');

    var stats = createStats();
    var victim = await setupTestUser('admin_victim_');

    console.log('Searching for the victim user by email_contains');
    var searchResult = await searchUsersAsAdmin(adminToken, 'email_contains=admin_victim_');

    if (searchResult && searchResult.success && searchResult.users.filter(function m(u) { return u.id === victim.userId; }).length === 1)
    {
        recordPass(stats, 'admin search found the victim user');
    }
    else
    {
        recordFail(stats, 'admin search did not find the victim user: ' + JSON.stringify(searchResult));
    }

    console.log('Getting the victim\'s details directly');
    var getResult = await getUserAsAdmin(adminToken, victim.userId);

    if (getResult && getResult.success && getResult.user.id === victim.userId)
    {
        recordPass(stats, 'admin GET user returned the correct user');
    }
    else
    {
        recordFail(stats, 'admin GET user did not return the expected user: ' + JSON.stringify(getResult));
    }

    console.log('Updating the victim\'s full name as admin');
    var updateResult = await updateUserAsAdmin(adminToken, victim.userId, { fullName: 'Admin Edited Name' });

    if (updateResult && updateResult.success && updateResult.user.fullName === 'Admin Edited Name')
    {
        recordPass(stats, 'admin update reflects the new full name');
    }
    else
    {
        recordFail(stats, 'admin update did not behave as expected: ' + JSON.stringify(updateResult));
    }

    console.log('Checking the victim\'s active token count (should be 1, from their login)');
    var tokensCountResult = await getTokensCountAsAdmin(adminToken, victim.userId);

    if (tokensCountResult && tokensCountResult.success && tokensCountResult.tokens_count >= 1)
    {
        recordPass(stats, 'tokens_count correctly reports at least 1 active token');
    }
    else
    {
        recordFail(stats, 'tokens_count did not behave as expected: ' + JSON.stringify(tokensCountResult));
    }

    console.log('Kicking the victim (invalidating their token)');
    var kickResult = await kickUserAsAdmin(adminToken, victim.userId);

    if (kickResult && kickResult.success)
    {
        recordPass(stats, 'kick request succeeded');
    }
    else
    {
        recordFail(stats, 'kick request failed: ' + (kickResult ? kickResult.message : 'no response'));
    }

    console.log('Confirming the victim\'s old token no longer works');
    var afterKickInfo = await getUserInfo(victim.token);
    checkFailed(stats, 'GET /user/me with a kicked token', afterKickInfo, null);

    console.log('Victim logs back in, then gets banned for 1 hour');
    var relogin = await loginUser(victim.userData);
    var banResult = await banUserAsAdmin(adminToken, victim.userId, 1);

    if (banResult && banResult.success)
    {
        recordPass(stats, 'ban request succeeded');
    }
    else
    {
        recordFail(stats, 'ban request failed: ' + (banResult ? banResult.message : 'no response'));
    }

    console.log('Checking the victim\'s ban status');
    var banStatusResult = await checkBanStatusAsAdmin(adminToken, victim.userId);

    if (banStatusResult && banStatusResult.success && banStatusResult.is_banned === true)
    {
        recordPass(stats, 'ban status correctly reports is_banned: true');
    }
    else
    {
        recordFail(stats, 'ban status did not behave as expected: ' + JSON.stringify(banStatusResult));
    }

    console.log('Confirming a banned user cannot log in');
    var loginWhileBannedResult = await loginUser(victim.userData);
    checkFailed(stats, 'login while banned', loginWhileBannedResult, 'banned');

    console.log('Promoting the victim to ADMIN level');
    var promoteResult = await setPermissionAsAdmin(adminToken, victim.userId, 1);

    if (promoteResult && promoteResult.success)
    {
        recordPass(stats, 'promotion to ADMIN succeeded');
    }
    else
    {
        recordFail(stats, 'promotion to ADMIN failed: ' + (promoteResult ? promoteResult.message : 'no response'));
    }

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [victim.userId] };
}

// #############################################################################
// #             STAGE 2 - "PERMISSION LEVEL BOUNDARIES"                     #
// #############################################################################

async function stageTwoPermissionBoundaries()
{
    console.log('\n========== STAGE 2: PERMISSION LEVEL BOUNDARIES ==========\n');

    var stats = createStats();

    var plainUser = await setupTestUser('admin_plain_');
    var promotedAdmin = await setupTestUser('admin_promoted_');
    var deleteTarget = await setupTestUser('admin_target_');

    console.log('A plain (non-admin) user attempts to search users (should be denied)');
    var plainSearchResult = await searchUsersAsAdmin(plainUser.token, '');
    checkFailed(stats, 'non-admin user calling admin search', plainSearchResult, null);

    console.log('A plain (non-admin) user attempts to delete another user (should be denied)');
    var plainDeleteResult = await deleteUserAsAdmin(plainUser.token, deleteTarget.userId);
    checkFailed(stats, 'non-admin user calling admin delete', plainDeleteResult, null);

    console.log('Promoting a user to ADMIN (not SUPER_ADMIN) level');
    await setPermissionAsAdmin(adminToken, promotedAdmin.userId, 1);
    var reloginPromoted = await loginUser(promotedAdmin.userData);
    var promotedToken = reloginPromoted.token;

    console.log('The promoted ADMIN (level 1) attempts to delete a user - requires SUPER_ADMIN, should be denied');
    var adminDeleteResult = await deleteUserAsAdmin(promotedToken, deleteTarget.userId);
    checkFailed(stats, 'ADMIN-level user calling super-admin-only delete', adminDeleteResult, null);

    console.log('The promoted ADMIN (level 1) CAN still search users (ADMIN-level action)');
    var promotedSearchResult = await searchUsersAsAdmin(promotedToken, '');

    if (promotedSearchResult && promotedSearchResult.success)
    {
        recordPass(stats, 'ADMIN-level user was correctly allowed to search users');
    }
    else
    {
        recordFail(stats, 'ADMIN-level user was unexpectedly denied searching users: ' + JSON.stringify(promotedSearchResult));
    }

    console.log('Demoting the promoted admin back to USER level, using the super admin');
    var demoteResult = await setPermissionAsAdmin(adminToken, promotedAdmin.userId, 0);

    if (demoteResult && demoteResult.success)
    {
        recordPass(stats, 'demotion back to USER succeeded');
    }
    else
    {
        recordFail(stats, 'demotion back to USER failed: ' + (demoteResult ? demoteResult.message : 'no response'));
    }

    console.log('Confirming the super admin itself CAN delete a user (positive case for the super-admin-only endpoint)');
    var deletableUser = await setupTestUser('admin_deletable_');
    var superAdminDeleteResult = await deleteUserAsAdmin(adminToken, deletableUser.userId);

    if (superAdminDeleteResult && superAdminDeleteResult.success)
    {
        recordPass(stats, 'super admin correctly allowed to delete a user');
    }
    else
    {
        recordFail(stats, 'super admin delete failed unexpectedly: ' + (superAdminDeleteResult ? superAdminDeleteResult.message : 'no response'));
    }

    console.log('Confirming the deleted user can no longer log in');
    var loginAfterDeleteResult = await loginUser(deletableUser.userData);
    checkFailed(stats, 'login after super-admin delete', loginAfterDeleteResult, 'User not found');

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [plainUser.userId, promotedAdmin.userId, deleteTarget.userId] };
}

// #############################################################################
// #                 STAGE 3 - "CONTENT ADMINISTRATION"                      #
// #############################################################################

async function stageThreeContentAdmin()
{
    console.log('\n========== STAGE 3: CONTENT ADMINISTRATION ==========\n');

    var stats = createStats();

    console.log('Creating a new series');
    var createResult = await createContentAsAdmin(adminToken, {
        title: 'Admin Test Series ' + Math.floor(Math.random() * 1000000),
        type: 'series',
        release_date: '2022-01-01',
        age_limit: 0
    });

    if (!createResult || !createResult.success)
    {
        recordFail(stats, 'could not create fixture series: ' + (createResult ? createResult.message : 'no response'));
        console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, contentId: null, episodeId: null };
    }

    recordPass(stats, 'series created successfully');
    var contentId = createResult.content.id;

    console.log('Updating the series title');
    var newTitle = 'Renamed Admin Test Series';
    var updateResult = await updateContentAsAdmin(adminToken, contentId, { title: newTitle });

    if (updateResult && updateResult.success && updateResult.content.title === newTitle)
    {
        recordPass(stats, 'content update reflects the new title');
    }
    else
    {
        recordFail(stats, 'content update did not behave as expected: ' + JSON.stringify(updateResult));
    }

    console.log('Adding an episode (S1E1)');
    var addEpisodeResult = await addEpisodeAsAdmin(adminToken, contentId, { season_number: 1, episode_number: 1, title: 'Pilot' });

    if (addEpisodeResult && addEpisodeResult.success)
    {
        recordPass(stats, 'episode added successfully');
    }
    else
    {
        recordFail(stats, 'episode add failed: ' + (addEpisodeResult ? addEpisodeResult.message : 'no response'));
    }

    var episodeId = addEpisodeResult.episode.id;

    console.log('Attempting to add a duplicate S1E1 (should fail)');
    var duplicateEpisodeResult = await addEpisodeAsAdmin(adminToken, contentId, { season_number: 1, episode_number: 1, title: 'Duplicate' });
    checkFailed(stats, 'adding a duplicate season/episode number', duplicateEpisodeResult, 'already exists');

    console.log('Updating the episode\'s title');
    var updateEpisodeResult = await updateEpisodeAsAdmin(adminToken, contentId, episodeId, { title: 'Updated Pilot Title' });

    if (updateEpisodeResult && updateEpisodeResult.success && updateEpisodeResult.episode.title === 'Updated Pilot Title')
    {
        recordPass(stats, 'episode update reflects the new title');
    }
    else
    {
        recordFail(stats, 'episode update did not behave as expected: ' + JSON.stringify(updateEpisodeResult));
    }

    console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, contentId: contentId, episodeId: episodeId };
}

// #############################################################################
// #                 STAGE 4 - "REVIEW ADMINISTRATION"                       #
// #############################################################################

async function stageFourReviewAdmin(contentId, episodeId)
{
    console.log('\n========== STAGE 4: REVIEW ADMINISTRATION ==========\n');

    var stats = createStats();

    if (!contentId || !episodeId)
    {
        recordFail(stats, 'no fixture content/episode available from stage 3 - skipping review admin tests');
        console.log('\nSTAGE 4 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, userIds: [] };
    }

    var reviewer = await setupTestUser('admin_reviewer_');
    var profileResult = await createProfile(reviewer.token);
    var profileId = profileResult.profiles[0].id;

    var addReviewResult = await addReview(reviewer.token, profileId, contentId, episodeId, { rating: 4, comment: 'Meh' });

    if (!addReviewResult || !addReviewResult.success)
    {
        recordFail(stats, 'could not create a review to test admin actions on: ' + (addReviewResult ? addReviewResult.message : 'no response'));
        console.log('\nSTAGE 4 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats, userIds: [reviewer.userId] };
    }

    var reviewId = addReviewResult.review.id;

    console.log('Editing the review as admin (fixing the rating)');
    var adminEditResult = await adminUpdateReview(adminToken, reviewId, { rating: 8 });

    if (adminEditResult && adminEditResult.success && adminEditResult.review.rating === 8)
    {
        recordPass(stats, 'admin correctly edited the review\'s rating');
    }
    else
    {
        recordFail(stats, 'admin review edit did not behave as expected: ' + JSON.stringify(adminEditResult));
    }

    console.log('Deleting the review as admin');
    var adminDeleteReviewResult = await adminRemoveReview(adminToken, reviewId);

    if (adminDeleteReviewResult && adminDeleteReviewResult.success)
    {
        recordPass(stats, 'admin correctly deleted the review');
    }
    else
    {
        recordFail(stats, 'admin review delete did not behave as expected: ' + JSON.stringify(adminDeleteReviewResult));
    }

    console.log('Attempting to delete the same review again (should fail - already gone)');
    var secondDeleteResult = await adminRemoveReview(adminToken, reviewId);
    checkFailed(stats, 'admin deleting an already-deleted review', secondDeleteResult, 'not found');

    console.log('\nSTAGE 4 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [reviewer.userId] };
}

// #############################################################################
// #    STAGE 5 - "MOVIE VIDEO, EPISODE REMOVAL & CONTENT DELETION"          #
// #############################################################################
// Covers three admin actions that were previously only exercised implicitly
// as cleanup steps (never asserted PASS/FAIL), plus the new movie-video
// endpoint which had no coverage at all.

async function stageFiveMovieVideoAndDeletion()
{
    console.log('\n========== STAGE 5: MOVIE VIDEO, EPISODE REMOVAL & CONTENT DELETION ==========\n');

    var stats = createStats();

    console.log('Creating a fixture movie');
    var movieResult = await createContentAsAdmin(adminToken, {
        title: 'Admin Movie Video Test ' + Math.floor(Math.random() * 1000000),
        type: 'movie',
        release_date: '2021-03-01',
        age_limit: 0
    });

    if (!movieResult || !movieResult.success)
    {
        recordFail(stats, 'could not create fixture movie: ' + (movieResult ? movieResult.message : 'no response'));
        console.log('\nSTAGE 5 complete ' + stats.passed + '/' + stats.total);
        return { stats: stats };
    }

    recordPass(stats, 'fixture movie created successfully');
    var movieId = movieResult.content.id;

    console.log('Attempting setMovieVideo without a videoUrl (should fail)');
    var noVideoUrlResult = await setMovieVideoAsAdmin(adminToken, movieId, {});
    checkFailed(stats, 'setMovieVideo with no videoUrl', noVideoUrlResult, 'videoUrl is required');

    console.log('Setting the movie\'s video for the first time (creates the underlying episode)');
    var setVideoResult = await setMovieVideoAsAdmin(adminToken, movieId, { videoUrl: 'movie_v1.mp4' });

    if (setVideoResult && setVideoResult.success && setVideoResult.episode.videoUrl === 'movie_v1.mp4'
        && setVideoResult.episode.seasonNumber === 1 && setVideoResult.episode.episodeNumber === 1)
    {
        recordPass(stats, 'movie video created correctly as season 1 / episode 1');
    }
    else
    {
        recordFail(stats, 'movie video creation did not behave as expected: ' + JSON.stringify(setVideoResult));
    }

    var episodeId = setVideoResult.episode.id;

    console.log('Confirming the episode is publicly visible with the right video URL');
    var publicEpisodeResult = await getEpisodePublic(movieId, episodeId);

    if (publicEpisodeResult && publicEpisodeResult.success && publicEpisodeResult.episode.videoUrl === 'movie_v1.mp4')
    {
        recordPass(stats, 'public GET episode confirms the movie video was set correctly');
    }
    else
    {
        recordFail(stats, 'public GET episode did not confirm the movie video: ' + JSON.stringify(publicEpisodeResult));
    }

    console.log('Updating the movie\'s video (upsert - should reuse the same episode, not create a second one)');
    var updateVideoResult = await setMovieVideoAsAdmin(adminToken, movieId, { videoUrl: 'movie_v2.mp4' });

    if (updateVideoResult && updateVideoResult.success && updateVideoResult.episode.id === episodeId && updateVideoResult.episode.videoUrl === 'movie_v2.mp4')
    {
        recordPass(stats, 'movie video update correctly reused the same episode and updated the URL');
    }
    else
    {
        recordFail(stats, 'movie video update did not behave as expected: ' + JSON.stringify(updateVideoResult));
    }

    console.log('Creating a fixture series and attempting setMovieVideo on it (should fail - series use the episode routes instead)');
    var seriesResult = await createContentAsAdmin(adminToken, {
        title: 'Admin Movie Video Series Guard ' + Math.floor(Math.random() * 1000000),
        type: 'series',
        release_date: '2021-01-01',
        age_limit: 0
    });
    var seriesId = seriesResult.content.id;
    var setVideoOnSeriesResult = await setMovieVideoAsAdmin(adminToken, seriesId, { videoUrl: 'nope.mp4' });
    checkFailed(stats, 'setMovieVideo called on a series', setVideoOnSeriesResult, 'only for movies');

    console.log('Removing the movie\'s episode directly');
    var removeEpisodeResult = await removeEpisodeAsAdmin(adminToken, movieId, episodeId);

    if (removeEpisodeResult && removeEpisodeResult.success)
    {
        recordPass(stats, 'episode removed successfully');
    }
    else
    {
        recordFail(stats, 'episode removal failed: ' + (removeEpisodeResult ? removeEpisodeResult.message : 'no response'));
    }

    console.log('Confirming the removed episode can no longer be fetched');
    var afterRemoveResult = await getEpisodePublic(movieId, episodeId);
    checkFailed(stats, 'GET a removed episode', afterRemoveResult, null);

    console.log('Deleting the fixture movie content entirely');
    var deleteMovieResult = await deleteContentAsAdmin(adminToken, movieId);

    if (deleteMovieResult && deleteMovieResult.success)
    {
        recordPass(stats, 'content deleted successfully');
    }
    else
    {
        recordFail(stats, 'content delete failed: ' + (deleteMovieResult ? deleteMovieResult.message : 'no response'));
    }

    console.log('Confirming the deleted content can no longer be fetched');
    var afterDeleteResult = await getContentPublic(movieId);
    checkFailed(stats, 'GET deleted content', afterDeleteResult, 'Content not found');

    console.log('Cleaning up the series guard fixture');
    var deleteSeriesResult = await deleteContentAsAdmin(adminToken, seriesId);

    if (!deleteSeriesResult || !deleteSeriesResult.success)
    {
        console.log('WARNING - could not delete series guard fixture: ' + seriesId);
    }

    console.log('\nSTAGE 5 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats };
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== ADMIN ROUTES TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    var stageOneResult = await stageOneUserAdmin();
    var stageTwoResult = await stageTwoPermissionBoundaries();
    var stageThreeResult = await stageThreeContentAdmin();
    var stageFourResult = await stageFourReviewAdmin(stageThreeResult.contentId, stageThreeResult.episodeId);
    var stageFiveResult = await stageFiveMovieVideoAndDeletion();

    var allUserIds = stageOneResult.userIds
        .concat(stageTwoResult.userIds)
        .concat(stageFourResult.userIds);

    console.log('\nCleaning up - deleting ' + allUserIds.length + ' users created during this run\n');

    for (var i = 0; i < allUserIds.length; i++)
    {
        var cleanupResult = await deleteUserAsAdmin(adminToken, allUserIds[i]);

        if (!cleanupResult || !cleanupResult.success)
        {
            console.log('WARNING - could not delete user with ID: ' + allUserIds[i]);
        }
    }

    if (stageThreeResult.contentId)
    {
        console.log('\nDeleting fixture content...');
        var deleteContentResult = await deleteContentAsAdmin(adminToken, stageThreeResult.contentId);

        if (!deleteContentResult || !deleteContentResult.success)
        {
            console.log('WARNING - could not delete fixture content: ' + stageThreeResult.contentId);
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
    console.log('STAGE 1 [USER ADMINISTRATION] complete ' + stageOneResult.stats.passed + '/' + stageOneResult.stats.total);
    console.log('STAGE 2 [PERMISSION LEVEL BOUNDARIES] complete ' + stageTwoResult.stats.passed + '/' + stageTwoResult.stats.total);
    console.log('STAGE 3 [CONTENT ADMINISTRATION] complete ' + stageThreeResult.stats.passed + '/' + stageThreeResult.stats.total);
    console.log('STAGE 4 [REVIEW ADMINISTRATION] complete ' + stageFourResult.stats.passed + '/' + stageFourResult.stats.total);
    console.log('STAGE 5 [MOVIE VIDEO, EPISODE REMOVAL & CONTENT DELETION] complete ' + stageFiveResult.stats.passed + '/' + stageFiveResult.stats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});