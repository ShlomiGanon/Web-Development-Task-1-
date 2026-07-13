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
// for cleanup - both require admin/super-admin permission level.
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

async function deleteContentAsAdmin(contentId)
{
    var response = await requestAsync('DELETE', '/admin/content/' + contentId, null, adminToken);
    return response.data;
}

async function createProfile(token)
{
    var response = await requestAsync('POST', '/profile', null, token);
    return response.data;
}

// --- Review routes under test ---

async function addReview(token, profileId, contentId, episodeId, body)
{
    var response = await requestAsync('POST', '/reviews/' + profileId + '/' + contentId + '/' + episodeId, body, token);
    return response.data;
}

async function updateReview(token, profileId, contentId, episodeId, body)
{
    var response = await requestAsync('PUT', '/reviews/' + profileId + '/' + contentId + '/' + episodeId, body, token);
    return response.data;
}

async function removeReview(token, profileId, contentId, episodeId)
{
    var response = await requestAsync('DELETE', '/reviews/' + profileId + '/' + contentId + '/' + episodeId, null, token);
    return response.data;
}

async function searchReviews(queryString)
{
    var response = await requestAsync('GET', '/reviews/?' + queryString, null, null);
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

async function setupTestUserWithProfile(prefix)
{
    var userData = generateRandomUser(prefix);
    var registerResult = await registerUser(userData);

    if (!registerResult || !registerResult.success)
    {
        throw new Error('could not register test user: ' + (registerResult ? registerResult.message : 'no response'));
    }

    var loginResult = await loginUser(userData);
    var infoResult = await getUserInfo(loginResult.token);
    var profileResult = await createProfile(loginResult.token);

    return {
        userData: userData,
        userId: infoResult.user.id,
        token: loginResult.token,
        profileId: profileResult.profiles[0].id
    };
}

// #############################################################################
// #        FIXTURE - one series with one episode, for reviews to target      #
// #############################################################################

async function createFixture()
{
    var contentResult = await createContentAsAdmin({
        title: 'Review Test Series ' + Math.floor(Math.random() * 1000000),
        type: 'series',
        release_date: '2020-01-01',
        age_limit: 0
    });

    if (!contentResult || !contentResult.success)
    {
        throw new Error('could not create fixture series: ' + (contentResult ? contentResult.message : 'no response'));
    }

    var contentId = contentResult.content.id;
    var episode1 = await addEpisodeAsAdmin(contentId, { season_number: 1, episode_number: 1, title: 'Pilot' });
    var episode2 = await addEpisodeAsAdmin(contentId, { season_number: 1, episode_number: 2, title: 'Second Episode' });
    // Dedicated episode for STAGE 5 only, so leftover reviews from earlier stages
    // (which all target episode1Id) can't contaminate the search-result counts.
    var episode3 = await addEpisodeAsAdmin(contentId, { season_number: 1, episode_number: 3, title: 'Third Episode' });

    if (!episode1.success || !episode2.success || !episode3.success)
    {
        throw new Error('could not add fixture episodes');
    }

    return { contentId: contentId, episode1Id: episode1.episode.id, episode2Id: episode2.episode.id, episode3Id: episode3.episode.id };
}

// #############################################################################
// #                     STAGE 1 - "ADD REVIEW"                              #
// #############################################################################

async function stageOneAddReview(fixture)
{
    console.log('\n========== STAGE 1: ADD REVIEW ==========\n');

    var stats = createStats();
    var reviewer = await setupTestUserWithProfile('rev_add_');

    console.log('Adding a valid review (rating 8, with a comment)');
    var addResult = await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 8, comment: 'Pretty good!' });

    if (addResult && addResult.success && addResult.review.rating === 8 && addResult.review.comment === 'Pretty good!')
    {
        recordPass(stats, 'valid review added correctly, with the right rating and comment');
    }
    else
    {
        recordFail(stats, 'valid review add did not behave as expected: ' + JSON.stringify(addResult));
    }

    console.log('Attempting to add a second review for the same episode by the same profile (should fail)');
    var duplicateResult = await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 5 });
    checkFailed(stats, 'duplicate review on the same episode', duplicateResult, 'already reviewed');

    console.log('Attempting to add a review with rating 0 (out of range, should fail)');
    var zeroRatingResult = await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode2Id, { rating: 0 });
    checkFailed(stats, 'review with rating 0', zeroRatingResult, null);

    console.log('Attempting to add a review with rating 11 (out of range, should fail)');
    var elevenRatingResult = await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode2Id, { rating: 11 });
    checkFailed(stats, 'review with rating 11', elevenRatingResult, null);

    console.log('Attempting to add a review with no rating at all (should fail)');
    var noRatingResult = await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode2Id, { comment: 'no rating here' });
    checkFailed(stats, 'review with missing rating', noRatingResult, 'rating is required');

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [reviewer.userId] };
}

// #############################################################################
// #                     STAGE 2 - "EDIT REVIEW"                             #
// #############################################################################

async function stageTwoEditReview(fixture)
{
    console.log('\n========== STAGE 2: EDIT REVIEW ==========\n');

    var stats = createStats();
    var reviewer = await setupTestUserWithProfile('rev_edit_');

    await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 5, comment: 'Okay' });

    console.log('Editing the review\'s rating and comment');
    var editResult = await updateReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 9, comment: 'Actually great!' });

    if (editResult && editResult.success && editResult.review.rating === 9 && editResult.review.comment === 'Actually great!')
    {
        recordPass(stats, 'review edit correctly updated rating and comment');
    }
    else
    {
        recordFail(stats, 'review edit did not behave as expected: ' + JSON.stringify(editResult));
    }

    console.log('Attempting to edit with an invalid rating (should fail)');
    var invalidEditResult = await updateReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 99 });
    checkFailed(stats, 'edit with an out-of-range rating', invalidEditResult, null);

    console.log('Attempting to edit a review that does not exist yet (different episode, should fail)');
    var noReviewEditResult = await updateReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode2Id, { rating: 7 });
    checkFailed(stats, 'edit on an episode never reviewed', noReviewEditResult, 'have not reviewed');

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [reviewer.userId] };
}

// #############################################################################
// #                    STAGE 3 - "REMOVE REVIEW"                            #
// #############################################################################

async function stageThreeRemoveReview(fixture)
{
    console.log('\n========== STAGE 3: REMOVE REVIEW ==========\n');

    var stats = createStats();
    var reviewer = await setupTestUserWithProfile('rev_remove_');

    await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 6 });

    console.log('Removing the review');
    var removeResult = await removeReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id);

    if (removeResult && removeResult.success)
    {
        recordPass(stats, 'review removed successfully');
    }
    else
    {
        recordFail(stats, 'review removal failed: ' + (removeResult ? removeResult.message : 'no response'));
    }

    console.log('Attempting to remove the same review again (should fail - already gone)');
    var secondRemoveResult = await removeReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id);
    checkFailed(stats, 'removing an already-removed review', secondRemoveResult, 'have not reviewed');

    console.log('Confirming the profile can add a fresh review again after removal');
    var reAddResult = await addReview(reviewer.token, reviewer.profileId, fixture.contentId, fixture.episode1Id, { rating: 10 });

    if (reAddResult && reAddResult.success)
    {
        recordPass(stats, 'profile can add a new review after removing the old one');
    }
    else
    {
        recordFail(stats, 'could not re-add a review after removal: ' + JSON.stringify(reAddResult));
    }

    console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [reviewer.userId] };
}

// #############################################################################
// #                    STAGE 4 - "REVIEW OWNERSHIP"                         #
// #############################################################################

async function stageFourOwnership(fixture)
{
    console.log('\n========== STAGE 4: REVIEW OWNERSHIP ==========\n');

    var stats = createStats();

    var victim = await setupTestUserWithProfile('rev_victim_');
    var attacker = await setupTestUserWithProfile('rev_attacker_');

    await addReview(victim.token, victim.profileId, fixture.contentId, fixture.episode1Id, { rating: 7, comment: 'Victim review' });

    console.log('Attacker attempting to add a review using the victim\'s profileId in the path (with the attacker\'s own token)');
    var addAsVictimResult = await addReview(attacker.token, victim.profileId, fixture.contentId, fixture.episode2Id, { rating: 1 });
    checkFailed(stats, 'add review using someone else\'s profileId', addAsVictimResult, null);

    console.log('Attacker attempting to edit the victim\'s review using the victim\'s profileId');
    var editAsVictimResult = await updateReview(attacker.token, victim.profileId, fixture.contentId, fixture.episode1Id, { rating: 1 });
    checkFailed(stats, 'edit review using someone else\'s profileId', editAsVictimResult, null);

    console.log('Attacker attempting to delete the victim\'s review using the victim\'s profileId');
    var deleteAsVictimResult = await removeReview(attacker.token, victim.profileId, fixture.contentId, fixture.episode1Id);
    checkFailed(stats, 'delete review using someone else\'s profileId', deleteAsVictimResult, null);

    console.log('Confirming the victim\'s review is untouched');
    var searchResult = await searchReviews('episode_id=' + fixture.episode1Id + '&profile_id=' + victim.profileId);

    if (searchResult && searchResult.success && searchResult.reviews.length === 1 && searchResult.reviews[0].rating === 7)
    {
        recordPass(stats, 'victim\'s review was left untouched by the attacker');
    }
    else
    {
        recordFail(stats, 'victim\'s review appears to have been affected: ' + JSON.stringify(searchResult));
    }

    console.log('\nSTAGE 4 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [victim.userId, attacker.userId] };
}

// #############################################################################
// #                     STAGE 5 - "SEARCH REVIEWS"                          #
// #############################################################################

async function stageFiveSearch(fixture)
{
    console.log('\n========== STAGE 5: SEARCH REVIEWS ==========\n');

    var stats = createStats();

    var reviewerA = await setupTestUserWithProfile('rev_search_a_');
    var reviewerB = await setupTestUserWithProfile('rev_search_b_');

    // Uses episode3Id, not episode1Id - previous stages already left several
    // reviews on episode1Id, which would otherwise inflate these counts.
    await addReview(reviewerA.token, reviewerA.profileId, fixture.contentId, fixture.episode3Id, { rating: 3, comment: 'Not great' });
    await addReview(reviewerB.token, reviewerB.profileId, fixture.contentId, fixture.episode3Id, { rating: 9, comment: 'Loved it' });

    console.log('Searching all reviews for this episode (should find both)');
    var byEpisodeResult = await searchReviews('episode_id=' + fixture.episode3Id);

    if (byEpisodeResult && byEpisodeResult.success && byEpisodeResult.reviews.length === 2)
    {
        recordPass(stats, 'episode_id search found both reviews');
    }
    else
    {
        recordFail(stats, 'episode_id search did not find exactly 2 reviews: ' + JSON.stringify(byEpisodeResult));
    }

    console.log('Searching by profile_id (should find only reviewer A\'s review)');
    var byProfileResult = await searchReviews('profile_id=' + reviewerA.profileId);

    if (byProfileResult && byProfileResult.success && byProfileResult.reviews.length === 1 && byProfileResult.reviews[0].rating === 3)
    {
        recordPass(stats, 'profile_id search correctly isolated reviewer A\'s review');
    }
    else
    {
        recordFail(stats, 'profile_id search did not behave as expected: ' + JSON.stringify(byProfileResult));
    }

    console.log('Searching by min_rating=8 (should find only reviewer B\'s review)');
    var minRatingResult = await searchReviews('episode_id=' + fixture.episode3Id + '&min_rating=8');

    if (minRatingResult && minRatingResult.success && minRatingResult.reviews.length === 1 && minRatingResult.reviews[0].rating === 9)
    {
        recordPass(stats, 'min_rating filter correctly isolated the higher-rated review');
    }
    else
    {
        recordFail(stats, 'min_rating filter did not behave as expected: ' + JSON.stringify(minRatingResult));
    }

    console.log('Searching by comment_contains="Loved" (should find only reviewer B\'s review)');
    var commentResult = await searchReviews('episode_id=' + fixture.episode3Id + '&comment_contains=Loved');

    if (commentResult && commentResult.success && commentResult.reviews.length === 1 && commentResult.reviews[0].rating === 9)
    {
        recordPass(stats, 'comment_contains filter correctly isolated the matching review');
    }
    else
    {
        recordFail(stats, 'comment_contains filter did not behave as expected: ' + JSON.stringify(commentResult));
    }

    console.log('\nSTAGE 5 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, userIds: [reviewerA.userId, reviewerB.userId] };
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== REVIEW ROUTES TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    console.log('Creating fixture series with two episodes...');
    var fixture = await createFixture();
    console.log('Fixture ready. content_id=' + fixture.contentId + '\n');

    var stageOneResult = await stageOneAddReview(fixture);
    var stageTwoResult = await stageTwoEditReview(fixture);
    var stageThreeResult = await stageThreeRemoveReview(fixture);
    var stageFourResult = await stageFourOwnership(fixture);
    var stageFiveResult = await stageFiveSearch(fixture);

    var allUserIds = stageOneResult.userIds
        .concat(stageTwoResult.userIds)
        .concat(stageThreeResult.userIds)
        .concat(stageFourResult.userIds)
        .concat(stageFiveResult.userIds);

    console.log('\nCleaning up - deleting ' + allUserIds.length + ' users created during this run\n');

    for (var i = 0; i < allUserIds.length; i++)
    {
        var cleanupResult = await deleteUserAsAdmin(allUserIds[i]);

        if (!cleanupResult || !cleanupResult.success)
        {
            console.log('WARNING - could not delete user with ID: ' + allUserIds[i]);
        }
    }

    console.log('\nDeleting fixture content (this leaves dangling review documents behind - see note below)...');
    var deleteContentResult = await deleteContentAsAdmin(fixture.contentId);

    if (!deleteContentResult || !deleteContentResult.success)
    {
        console.log('WARNING - could not delete fixture content: ' + fixture.contentId);
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
    console.log('STAGE 1 [ADD REVIEW] complete ' + stageOneResult.stats.passed + '/' + stageOneResult.stats.total);
    console.log('STAGE 2 [EDIT REVIEW] complete ' + stageTwoResult.stats.passed + '/' + stageTwoResult.stats.total);
    console.log('STAGE 3 [REMOVE REVIEW] complete ' + stageThreeResult.stats.passed + '/' + stageThreeResult.stats.total);
    console.log('STAGE 4 [REVIEW OWNERSHIP] complete ' + stageFourResult.stats.passed + '/' + stageFourResult.stats.total);
    console.log('STAGE 5 [SEARCH REVIEWS] complete ' + stageFiveResult.stats.passed + '/' + stageFiveResult.stats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});