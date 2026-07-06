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
// Must belong to an account that already has ADMIN permission level on the server
// (this script does not bootstrap admin permissions - it assumes they exist).
var ADMIN_EMAIL_OR_PHONE = '';
var ADMIN_PASSWORD = '';

var TEST_CONTENT_COUNT = 4;

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

// Builds a "?key=value&key2=value2" query string from a plain object,
// skipping undefined/null values.
function buildQueryString(paramsObj)
{
    var parts = [];

    for (var key in paramsObj)
    {
        if (paramsObj.hasOwnProperty(key) && paramsObj[key] !== undefined && paramsObj[key] !== null)
        {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(paramsObj[key]));
        }
    }

    return parts.length > 0 ? '?' + parts.join('&') : '';
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

// ==================== SHARED API WRAPPER FUNCTIONS ====================

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

// ---- Content API wrappers (match content_routes.js exactly) ----

async function createContentRequest(token, contentData)
{
    var response = await requestAsync('POST', '/content', contentData, token);
    return response.data;
}

// No token needed - GET /content/:contentId is public.
async function getContentByIdRequest(contentId)
{
    var response = await requestAsync('GET', '/content/' + contentId, null, null);
    return response.data;
}

async function updateContentRequest(token, contentId, changes)
{
    var response = await requestAsync('PUT', '/content/' + contentId, changes, token);
    return response.data;
}

async function deleteContentRequest(token, contentId)
{
    var response = await requestAsync('DELETE', '/content/' + contentId, null, token);
    return response.data;
}

// No token needed - GET /content is public.
async function searchContentRequest(queryParams)
{
    var response = await requestAsync('GET', '/content' + buildQueryString(queryParams), null, null);
    return response.data;
}

// ==================== TEST DATA GENERATION ====================

// Builds a random content payload for /content.
// - runMarkerCategory is a category unique to this run, attached to every
//   generated item, so it can later be used to isolate exactly this run's
//   content from anything else already on the server.
// - runPrefix is prepended to the title for the same isolation purpose,
//   used by the title_contains search checks.
function generateRandomContent(index, runPrefix, runMarkerCategory)
{
    var randomNumber = Math.floor(Math.random() * 1000000);
    var titlePool = ['Shadow Realm', 'Silent Horizon', 'Crimson Tide', 'Neon Drift', 'Broken Compass', 'Iron Harvest'];
    var typePool = ['movie', 'series'];
    var categoryPool = ['drama', 'comedy', 'action', 'thriller', 'scifi'];
    var ageLimitPool = [0, 12, 16, 18];

    var title = runPrefix + titlePool[index % titlePool.length] + '_' + randomNumber;
    var type = typePool[index % typePool.length];
    var rotatingCategory = categoryPool[index % categoryPool.length];
    var age_limit = ageLimitPool[index % ageLimitPool.length];
    var release_date = new Date(2020 + (index % 5), index % 12, 1).toISOString();

    return {
        title: title,
        description: 'Auto-generated test content #' + index,
        cover_image_name: 'cover_' + randomNumber + '.png',
        type: type,
        categories: [rotatingCategory, runMarkerCategory],
        release_date: release_date,
        age_limit: age_limit,
        videoUrl: 'https://example.com/video_' + randomNumber + '.mp4'
    };
}

// ==================== SHARED RESULT LOGGING HELPERS ====================

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

// Compares two id arrays for exact set equality, ignoring order.
function idSetsMatch(actualIds, expectedIds)
{
    if (actualIds.length !== expectedIds.length)
    {
        return false;
    }

    var sortedActual = actualIds.slice().sort();
    var sortedExpected = expectedIds.slice().sort();

    for (var i = 0; i < sortedActual.length; i++)
    {
        if (sortedActual[i] !== sortedExpected[i])
        {
            return false;
        }
    }

    return true;
}

// Fetches every content id currently on the server, paging through /content.
async function fetchAllContentIds()
{
    var ids = [];
    var skip = 0;
    var limit = 100;

    while (true)
    {
        var result = await searchContentRequest({ limit: limit, skip: skip, sort: 'createdAt', sortOrder: 'asc' });

        if (!result || !result.success || !result.content)
        {
            break;
        }

        for (var i = 0; i < result.content.length; i++)
        {
            ids.push(result.content[i].id);
        }

        if (result.content.length < limit)
        {
            break;
        }

        skip += limit;
    }

    return ids;
}

// #############################################################################
// #                    STAGE 1 - "BASELINE SNAPSHOT"                        #
// #############################################################################

async function stageOneBaselineSnapshot()
{
    console.log('\n========== STAGE 1: BASELINE SNAPSHOT ==========\n');

    var stats = createStats();
    var baselineIds = await fetchAllContentIds();

    if (baselineIds !== null && baselineIds !== undefined)
    {
        recordPass(stats, 'baseline snapshot captured - server currently holds ' + baselineIds.length + ' content item(s)');
    }
    else
    {
        recordFail(stats, 'could not capture baseline content snapshot');
    }

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, baselineIds: baselineIds };
}

// #############################################################################
// #                    STAGE 2 - "CONTENT CREATION"                         #
// #############################################################################

async function stageTwoContentCreation(runPrefix, runMarkerCategory)
{
    console.log('\n========== STAGE 2: CONTENT CREATION ==========\n');

    var stats = createStats();
    var createdContents = [];

    for (var i = 0; i < TEST_CONTENT_COUNT; i++)
    {
        var contentData = generateRandomContent(i, runPrefix, runMarkerCategory);

        console.log('Creating content: ' + contentData.title);
        var createResult = await createContentRequest(adminToken, contentData);

        if (!createResult || !createResult.success || !createResult.content)
        {
            recordFail(stats, 'could not create content: ' + (createResult ? createResult.message : 'no response'));
            continue;
        }

        recordPass(stats, 'created content "' + contentData.title + '" with id ' + createResult.content.id);

        createdContents.push({ id: createResult.content.id, data: contentData });
    }

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return { stats: stats, createdContents: createdContents };
}

// #############################################################################
// #                    STAGE 3 - "SEARCH VERIFICATION"                      #
// #############################################################################

async function stageThreeSearchVerification(createdContents, baselineIds, runPrefix, runMarkerCategory)
{
    console.log('\n========== STAGE 3: SEARCH VERIFICATION ==========\n');

    var stats = createStats();
    var createdIds = createdContents.map(function toId(entry) { return entry.id; });

    // contain_category with the run's unique marker should return exactly
    // the items created in this run - nothing more, nothing less.
    console.log('Searching by contain_category=' + runMarkerCategory);
    var containResult = await searchContentRequest({ contain_category: runMarkerCategory, limit: 1000 });

    if (containResult && containResult.success)
    {
        var containIds = containResult.content.map(function toId(item) { return item.id; });

        if (idSetsMatch(containIds, createdIds))
        {
            recordPass(stats, 'contain_category search returned exactly the created content items');
        }
        else
        {
            recordFail(stats, 'contain_category search did not return the expected set. Got: ' + JSON.stringify(containIds));
        }
    }
    else
    {
        recordFail(stats, 'contain_category search request failed: ' + (containResult ? containResult.message : 'no response'));
    }

    // exclude_category with the run's unique marker should return exactly
    // the baseline content - none of this run's items should appear.
    console.log('Searching by exclude_category=' + runMarkerCategory);
    var excludeResult = await searchContentRequest({ exclude_category: runMarkerCategory, limit: 1000 });

    if (excludeResult && excludeResult.success)
    {
        var excludeIds = excludeResult.content.map(function toId(item) { return item.id; });

        if (idSetsMatch(excludeIds, baselineIds))
        {
            recordPass(stats, 'exclude_category search returned exactly the pre-existing (baseline) content');
        }
        else
        {
            recordFail(stats, 'exclude_category search did not match the baseline set. Expected ' + baselineIds.length + ' items, got ' + excludeIds.length);
        }
    }
    else
    {
        recordFail(stats, 'exclude_category search request failed: ' + (excludeResult ? excludeResult.message : 'no response'));
    }

    // exact_category with [marker, 'drama'] should return only created items
    // that were assigned BOTH the marker and 'drama' (AND semantics).
    var expectedExactIds = createdContents
        .filter(function hasBoth(entry) { return entry.data.categories.indexOf('drama') !== -1; })
        .map(function toId(entry) { return entry.id; });

    console.log('Searching by exact_category=' + runMarkerCategory + ',drama');
    var exactResult = await searchContentRequest({ exact_category: runMarkerCategory + ',drama', limit: 1000 });

    if (exactResult && exactResult.success)
    {
        var exactIds = exactResult.content.map(function toId(item) { return item.id; });

        if (idSetsMatch(exactIds, expectedExactIds))
        {
            recordPass(stats, 'exact_category search returned exactly the items matching ALL given categories');
        }
        else
        {
            recordFail(stats, 'exact_category search did not match expected set. Expected ' + expectedExactIds.length + ' items, got ' + exactIds.length);
        }
    }
    else
    {
        recordFail(stats, 'exact_category search request failed: ' + (exactResult ? exactResult.message : 'no response'));
    }

    // type=movie combined with the marker should return only this run's movies.
    var expectedMovieIds = createdContents
        .filter(function isMovie(entry) { return entry.data.type === 'movie'; })
        .map(function toId(entry) { return entry.id; });

    console.log('Searching by contain_category=' + runMarkerCategory + '&type=movie');
    var typeResult = await searchContentRequest({ contain_category: runMarkerCategory, type: 'movie', limit: 1000 });

    if (typeResult && typeResult.success)
    {
        var typeIds = typeResult.content.map(function toId(item) { return item.id; });

        if (idSetsMatch(typeIds, expectedMovieIds))
        {
            recordPass(stats, 'type filter (combined with marker category) returned exactly the created movies');
        }
        else
        {
            recordFail(stats, 'type filter did not match expected set. Expected ' + expectedMovieIds.length + ' items, got ' + typeIds.length);
        }
    }
    else
    {
        recordFail(stats, 'type filter search request failed: ' + (typeResult ? typeResult.message : 'no response'));
    }

    // min_age_limit=16 combined with the marker should return only this run's
    // items with age_limit >= 16.
    var expectedAgeIds = createdContents
        .filter(function isAdult(entry) { return entry.data.age_limit >= 16; })
        .map(function toId(entry) { return entry.id; });

    console.log('Searching by contain_category=' + runMarkerCategory + '&min_age_limit=16');
    var ageResult = await searchContentRequest({ contain_category: runMarkerCategory, min_age_limit: 16, limit: 1000 });

    if (ageResult && ageResult.success)
    {
        var ageIds = ageResult.content.map(function toId(item) { return item.id; });

        if (idSetsMatch(ageIds, expectedAgeIds))
        {
            recordPass(stats, 'min_age_limit filter (combined with marker category) returned the expected items');
        }
        else
        {
            recordFail(stats, 'min_age_limit filter did not match expected set. Expected ' + expectedAgeIds.length + ' items, got ' + ageIds.length);
        }
    }
    else
    {
        recordFail(stats, 'min_age_limit filter search request failed: ' + (ageResult ? ageResult.message : 'no response'));
    }

    // title_contains with the run prefix should also isolate exactly this run's items.
    console.log('Searching by title_contains=' + runPrefix);
    var titleResult = await searchContentRequest({ title_contains: runPrefix, limit: 1000 });

    if (titleResult && titleResult.success)
    {
        var titleIds = titleResult.content.map(function toId(item) { return item.id; });

        if (idSetsMatch(titleIds, createdIds))
        {
            recordPass(stats, 'title_contains search returned exactly the created content items');
        }
        else
        {
            recordFail(stats, 'title_contains search did not match expected set. Expected ' + createdIds.length + ' items, got ' + titleIds.length);
        }
    }
    else
    {
        recordFail(stats, 'title_contains search request failed: ' + (titleResult ? titleResult.message : 'no response'));
    }

    console.log('\nSTAGE 3 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #              STAGE 4 - "CONTENT LIFECYCLE OPERATIONS"                   #
// #############################################################################
// For each created item: fetch it, update it, and re-fetch to confirm the
// update actually persisted on the server (not just reflected in the response).

async function stageFourLifecycleOperations(createdContents)
{
    console.log('\n========== STAGE 4: CONTENT LIFECYCLE OPERATIONS ==========\n');

    var stats = createStats();

    for (var i = 0; i < createdContents.length; i++)
    {
        var entry = createdContents[i];

        console.log('Fetching content ' + entry.id);
        var getResult = await getContentByIdRequest(entry.id);

        if (getResult && getResult.success && getResult.content && getResult.content.title === entry.data.title)
        {
            recordPass(stats, 'GET returned the correct content for id ' + entry.id);
        }
        else
        {
            recordFail(stats, 'GET did not return the expected content for id ' + entry.id + ': ' + (getResult ? getResult.message : 'no response'));
        }

        var randomNumber = Math.floor(Math.random() * 1000000);
        var updatedTitle = entry.data.title + '_updated' + randomNumber;
        var updatedAgeLimit = (entry.data.age_limit + 1) % 19;

        console.log('Updating content ' + entry.id + ' with new title and age_limit');
        var updateResult = await updateContentRequest(adminToken, entry.id, { title: updatedTitle, age_limit: updatedAgeLimit });

        if (updateResult && updateResult.success && updateResult.content && updateResult.content.title === updatedTitle && updateResult.content.age_limit === updatedAgeLimit)
        {
            recordPass(stats, 'update response reflects the new values for id ' + entry.id);
        }
        else
        {
            recordFail(stats, 'update response does not reflect the new values for id ' + entry.id + ': ' + (updateResult ? updateResult.message : 'no response'));
        }

        var reFetchResult = await getContentByIdRequest(entry.id);

        if (reFetchResult && reFetchResult.success && reFetchResult.content && reFetchResult.content.title === updatedTitle && reFetchResult.content.age_limit === updatedAgeLimit)
        {
            recordPass(stats, 'update persisted correctly on the server for id ' + entry.id);
        }
        else
        {
            recordFail(stats, 'update was NOT persisted on the server for id ' + entry.id);
        }
    }

    console.log('\nSTAGE 4 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #            STAGE 5 - "CLEANUP & FINAL VERIFICATION"                     #
// #############################################################################
// Deletes every content item this run created, confirms each is actually gone,
// then verifies the server's content list is back to exactly the baseline.

async function stageFiveCleanupAndVerify(createdContents, baselineIds)
{
    console.log('\n========== STAGE 5: CLEANUP & FINAL VERIFICATION ==========\n');

    var stats = createStats();

    for (var i = 0; i < createdContents.length; i++)
    {
        var entry = createdContents[i];

        console.log('Deleting content ' + entry.id);
        var deleteResult = await deleteContentRequest(adminToken, entry.id);

        if (!deleteResult || !deleteResult.success)
        {
            recordFail(stats, 'could not delete content ' + entry.id + ': ' + (deleteResult ? deleteResult.message : 'no response'));
            continue;
        }

        recordPass(stats, 'deleted content ' + entry.id);

        var getAfterDeleteResult = await getContentByIdRequest(entry.id);

        if (getAfterDeleteResult && getAfterDeleteResult.success === false)
        {
            recordPass(stats, 'content ' + entry.id + ' correctly not found after deletion');
        }
        else
        {
            recordFail(stats, 'content ' + entry.id + ' still retrievable after deletion - this should not happen!');
        }
    }

    console.log('\nVerifying the server holds exactly the same content it held before the test');
    var finalIds = await fetchAllContentIds();

    if (idSetsMatch(finalIds, baselineIds))
    {
        recordPass(stats, 'server content matches the pre-test baseline exactly (' + baselineIds.length + ' item(s))');
    }
    else
    {
        recordFail(stats, 'server content does NOT match the pre-test baseline. Expected ' + baselineIds.length + ' item(s), found ' + finalIds.length);
    }

    console.log('\nSTAGE 5 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== CONTENT ENDPOINT TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    var runPrefix = 'testrun_' + Date.now() + '_';
    var runMarkerCategory = 'testcat_' + Date.now();

    var stageOneResult = await stageOneBaselineSnapshot();
    var stageTwoResult = await stageTwoContentCreation(runPrefix, runMarkerCategory);
    var stageThreeStats = await stageThreeSearchVerification(stageTwoResult.createdContents, stageOneResult.baselineIds, runPrefix, runMarkerCategory);
    var stageFourStats = await stageFourLifecycleOperations(stageTwoResult.createdContents);
    var stageFiveStats = await stageFiveCleanupAndVerify(stageTwoResult.createdContents, stageOneResult.baselineIds);

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
    console.log('STAGE 1 [BASELINE SNAPSHOT] complete ' + stageOneResult.stats.passed + '/' + stageOneResult.stats.total);
    console.log('STAGE 2 [CONTENT CREATION] complete ' + stageTwoResult.stats.passed + '/' + stageTwoResult.stats.total);
    console.log('STAGE 3 [SEARCH VERIFICATION] complete ' + stageThreeStats.passed + '/' + stageThreeStats.total);
    console.log('STAGE 4 [CONTENT LIFECYCLE OPERATIONS] complete ' + stageFourStats.passed + '/' + stageFourStats.total);
    console.log('STAGE 5 [CLEANUP & FINAL VERIFICATION] complete ' + stageFiveStats.passed + '/' + stageFiveStats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});