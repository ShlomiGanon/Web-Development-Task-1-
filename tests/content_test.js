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
// NOTE: this script creates and deletes content as a fixture, which requires
// admin permission level.
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

// --- Content routes under test (all public, no token needed) ---

async function getContent(contentId)
{
    var response = await requestAsync('GET', '/content/' + contentId, null, null);
    return response.data;
}

async function searchContent(queryString)
{
    var response = await requestAsync('GET', '/content/?' + queryString, null, null);
    return response.data;
}

async function getAllEpisodes(contentId)
{
    var response = await requestAsync('GET', '/content/' + contentId + '/episodes', null, null);
    return response.data;
}

async function getEpisode(contentId, episodeId)
{
    var response = await requestAsync('GET', '/content/' + contentId + '/episodes/' + episodeId, null, null);
    return response.data;
}

async function getNextEpisode(contentId, episodeId)
{
    var response = await requestAsync('GET', '/content/' + contentId + '/episodes/' + episodeId + '/next', null, null);
    return response.data;
}

async function getPrevEpisode(contentId, episodeId)
{
    var response = await requestAsync('GET', '/content/' + contentId + '/episodes/' + episodeId + '/prev', null, null);
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
// #             FIXTURE - one movie and one two-season series               #
// #############################################################################

async function createFixture()
{
    var marker = 'CTFX' + Math.floor(Math.random() * 1000000);

    var movieResult = await createContentAsAdmin({
        title: marker + ' Movie',
        type: 'movie',
        release_date: '2019-05-01',
        categories: [marker],
        age_limit: 0
    });

    if (!movieResult || !movieResult.success)
    {
        throw new Error('could not create fixture movie: ' + (movieResult ? movieResult.message : 'no response'));
    }

    var seriesResult = await createContentAsAdmin({
        title: marker + ' Series',
        type: 'series',
        release_date: '2021-06-01',
        categories: [marker],
        age_limit: 0
    });

    if (!seriesResult || !seriesResult.success)
    {
        throw new Error('could not create fixture series: ' + (seriesResult ? seriesResult.message : 'no response'));
    }

    var seriesId = seriesResult.content.id;

    var s1e1 = await addEpisodeAsAdmin(seriesId, { season_number: 1, episode_number: 1, title: 'S1E1' });
    var s1e2 = await addEpisodeAsAdmin(seriesId, { season_number: 1, episode_number: 2, title: 'S1E2' });
    var s2e1 = await addEpisodeAsAdmin(seriesId, { season_number: 2, episode_number: 1, title: 'S2E1' });

    if (!s1e1.success || !s1e2.success || !s2e1.success)
    {
        throw new Error('could not add all fixture episodes');
    }

    var movieId = movieResult.content.id;
    var movieVideoResult = await setMovieVideoAsAdmin(movieId, { videoUrl: 'fixture_movie.mp4' });

    if (!movieVideoResult || !movieVideoResult.success)
    {
        throw new Error('could not set fixture movie video: ' + (movieVideoResult ? movieVideoResult.message : 'no response'));
    }

    return {
        marker: marker,
        movieId: movieId,
        movieEpisodeId: movieVideoResult.episode.id,
        seriesId: seriesId,
        s1e1Id: s1e1.episode.id,
        s1e2Id: s1e2.episode.id,
        s2e1Id: s2e1.episode.id
    };
}

// #############################################################################
// #               STAGE 1 - "GET & SEARCH CONTENT"                          #
// #############################################################################

async function stageOneGetAndSearch(fixture)
{
    console.log('\n========== STAGE 1: GET & SEARCH CONTENT ==========\n');

    var stats = createStats();

    console.log('Getting the fixture movie by ID');
    var movieResult = await getContent(fixture.movieId);

    if (movieResult && movieResult.success && movieResult.content.title.indexOf(fixture.marker) !== -1)
    {
        recordPass(stats, 'GET /content/:contentId returned the correct movie');
    }
    else
    {
        recordFail(stats, 'GET /content/:contentId did not return the expected movie: ' + JSON.stringify(movieResult));
    }

    console.log('Getting content with an invalid ID format (should fail)');
    var invalidFormatResult = await getContent('not-a-valid-id');
    checkFailed(stats, 'GET /content with invalid ID format', invalidFormatResult, 'Invalid content ID format');

    console.log('Getting content with a well-formed but non-existent ID (should fail)');
    var nonExistentResult = await getContent('64b000000000000000000000');
    checkFailed(stats, 'GET /content with non-existent ID', nonExistentResult, 'Content not found');

    console.log('Searching by title_contains matching the fixture marker');
    var titleSearchResult = await searchContent('title_contains=' + fixture.marker);

    if (titleSearchResult && titleSearchResult.success && titleSearchResult.content.length === 2)
    {
        recordPass(stats, 'title_contains search found exactly both fixture items');
    }
    else
    {
        recordFail(stats, 'title_contains search did not find exactly 2 items: ' + JSON.stringify(titleSearchResult));
    }

    console.log('Searching by type=movie within the fixture category (should only find the movie)');
    var movieTypeResult = await searchContent('contain_category=' + fixture.marker + '&type=movie');

    if (movieTypeResult && movieTypeResult.success)
    {
        var ids = movieTypeResult.content.map(function toId(c) { return c.id; });
        var hasMovie = ids.indexOf(fixture.movieId) !== -1;
        var hasSeries = ids.indexOf(fixture.seriesId) !== -1;

        if (hasMovie && !hasSeries)
        {
            recordPass(stats, 'type=movie filter correctly included the movie and excluded the series');
        }
        else
        {
            recordFail(stats, 'type=movie filter did not behave as expected. hasMovie=' + hasMovie + ', hasSeries=' + hasSeries);
        }
    }
    else
    {
        recordFail(stats, 'type=movie search failed: ' + (movieTypeResult ? movieTypeResult.message : 'no response'));
    }

    console.log('Searching with an invalid sortOrder value (should fail)');
    var invalidSortResult = await searchContent('sortOrder=backwards');
    checkFailed(stats, 'search with invalid sortOrder', invalidSortResult, null);

    console.log('\nSTAGE 1 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #                    STAGE 2 - "EPISODES"                                 #
// #############################################################################

async function stageTwoEpisodes(fixture)
{
    console.log('\n========== STAGE 2: EPISODES ==========\n');

    var stats = createStats();

    console.log('Attempting to add an episode to the fixture movie (should be rejected - series only)');
    var addToMovieResult = await addEpisodeAsAdmin(fixture.movieId, { season_number: 1, episode_number: 1 });
    checkFailed(stats, 'adding an episode to a movie', addToMovieResult, 'series');

    console.log('Attempting setMovieVideo on the fixture series (should be rejected - movies only)');
    var setVideoOnSeriesResult = await setMovieVideoAsAdmin(fixture.seriesId, { videoUrl: 'nope.mp4' });
    checkFailed(stats, 'setMovieVideo called on a series', setVideoOnSeriesResult, 'only for movies');

    console.log('Attempting setMovieVideo on the fixture movie with no videoUrl (should fail)');
    var setVideoNoUrlResult = await setMovieVideoAsAdmin(fixture.movieId, {});
    checkFailed(stats, 'setMovieVideo with no videoUrl', setVideoNoUrlResult, 'videoUrl is required');

    console.log('Getting all episodes of the movie (should fail - not a series)');
    var movieEpisodesResult = await getAllEpisodes(fixture.movieId);
    checkFailed(stats, 'getting episodes of a movie', movieEpisodesResult, 'not a series');

    console.log('Getting all episodes of the fixture series, grouped by season');
    var allEpisodesResult = await getAllEpisodes(fixture.seriesId);

    if (allEpisodesResult && allEpisodesResult.success && allEpisodesResult.seasons.length === 2
        && allEpisodesResult.seasons[0].length === 2 && allEpisodesResult.seasons[1].length === 1)
    {
        recordPass(stats, 'seasons are grouped correctly: season 1 has 2 episodes, season 2 has 1');
    }
    else
    {
        recordFail(stats, 'seasons were not grouped as expected: ' + JSON.stringify(allEpisodesResult));
    }

    console.log('Getting a specific episode by ID (S1E1)');
    var singleEpisodeResult = await getEpisode(fixture.seriesId, fixture.s1e1Id);

    if (singleEpisodeResult && singleEpisodeResult.success && singleEpisodeResult.episode.seasonNumber === 1 && singleEpisodeResult.episode.episodeNumber === 1)
    {
        recordPass(stats, 'GET episode by ID returned the correct season/episode numbers');
    }
    else
    {
        recordFail(stats, 'GET episode by ID did not return the expected data: ' + JSON.stringify(singleEpisodeResult));
    }

    console.log('Getting an episode using a mismatched contentId (episode belongs to a different content)');
    var mismatchedResult = await getEpisode(fixture.movieId, fixture.s1e1Id);
    checkFailed(stats, 'GET episode with mismatched contentId', mismatchedResult, null);

    console.log('Getting the next episode after S1E1 (should be S1E2)');
    var nextFromE1 = await getNextEpisode(fixture.seriesId, fixture.s1e1Id);

    if (nextFromE1 && nextFromE1.success && nextFromE1.episode.id === fixture.s1e2Id)
    {
        recordPass(stats, 'next episode after S1E1 is correctly S1E2');
    }
    else
    {
        recordFail(stats, 'next episode after S1E1 was not S1E2: ' + JSON.stringify(nextFromE1));
    }

    console.log('Getting the next episode after S1E2 (should cross into S2E1)');
    var nextFromE2 = await getNextEpisode(fixture.seriesId, fixture.s1e2Id);

    if (nextFromE2 && nextFromE2.success && nextFromE2.episode.id === fixture.s2e1Id)
    {
        recordPass(stats, 'next episode after S1E2 correctly crosses into S2E1');
    }
    else
    {
        recordFail(stats, 'next episode after S1E2 did not cross into S2E1: ' + JSON.stringify(nextFromE2));
    }

    console.log('Getting the next episode after S2E1, the last episode (should fail - no next episode)');
    var nextFromLast = await getNextEpisode(fixture.seriesId, fixture.s2e1Id);
    checkFailed(stats, 'next episode after the last episode', nextFromLast, 'No next episode found');

    console.log('Getting the previous episode before S2E1 (should cross back into S1E2)');
    var prevFromS2E1 = await getPrevEpisode(fixture.seriesId, fixture.s2e1Id);

    if (prevFromS2E1 && prevFromS2E1.success && prevFromS2E1.episode.id === fixture.s1e2Id)
    {
        recordPass(stats, 'previous episode before S2E1 correctly crosses back into S1E2');
    }
    else
    {
        recordFail(stats, 'previous episode before S2E1 did not cross back into S1E2: ' + JSON.stringify(prevFromS2E1));
    }

    console.log('Getting the previous episode before S1E1, the first episode (should fail - no previous episode)');
    var prevFromFirst = await getPrevEpisode(fixture.seriesId, fixture.s1e1Id);
    checkFailed(stats, 'previous episode before the first episode', prevFromFirst, 'No previous episode found');

    console.log('Getting the fixture movie\'s single episode by ID (via setMovieVideo)');
    var movieEpisodeResult = await getEpisode(fixture.movieId, fixture.movieEpisodeId);

    if (movieEpisodeResult && movieEpisodeResult.success && movieEpisodeResult.episode.seasonNumber === 1
        && movieEpisodeResult.episode.episodeNumber === 1 && movieEpisodeResult.episode.videoUrl === 'fixture_movie.mp4')
    {
        recordPass(stats, 'GET movie episode by ID returned the correct season/episode numbers and video URL');
    }
    else
    {
        recordFail(stats, 'GET movie episode by ID did not return the expected data: ' + JSON.stringify(movieEpisodeResult));
    }

    console.log('Getting the next episode after the movie\'s only episode (should fail - it is the only one)');
    var nextFromMovie = await getNextEpisode(fixture.movieId, fixture.movieEpisodeId);
    checkFailed(stats, 'next episode after a movie\'s only episode', nextFromMovie, 'No next episode found');

    console.log('Getting the previous episode before the movie\'s only episode (should fail - it is the only one)');
    var prevFromMovie = await getPrevEpisode(fixture.movieId, fixture.movieEpisodeId);
    checkFailed(stats, 'previous episode before a movie\'s only episode', prevFromMovie, 'No previous episode found');

    console.log('\nSTAGE 2 complete ' + stats.passed + '/' + stats.total);

    return stats;
}

// #############################################################################
// #                                   MAIN                                   #
// #############################################################################

async function main()
{
    console.log('=== CONTENT ROUTES TEST SCRIPT ===\n');

    var adminCredentials = await resolveAdminCredentials();

    console.log('\nLogging in as admin...');
    adminToken = await loginAdmin(adminCredentials.email, adminCredentials.password);
    console.log('Admin login successful.\n');

    console.log('Creating fixture content (one movie, one two-season series)...');
    var fixture = await createFixture();
    console.log('Fixture ready. movie_id=' + fixture.movieId + ', series_id=' + fixture.seriesId + '\n');

    var stageOneStats = await stageOneGetAndSearch(fixture);
    var stageTwoStats = await stageTwoEpisodes(fixture);

    console.log('\nCleaning up fixture content...');
    var deleteMovieResult = await deleteContentAsAdmin(fixture.movieId);
    var deleteSeriesResult = await deleteContentAsAdmin(fixture.seriesId);

    if (!deleteMovieResult || !deleteMovieResult.success)
    {
        console.log('WARNING - could not delete fixture movie: ' + fixture.movieId);
    }

    if (!deleteSeriesResult || !deleteSeriesResult.success)
    {
        console.log('WARNING - could not delete fixture series: ' + fixture.seriesId);
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
    console.log('STAGE 1 [GET & SEARCH CONTENT] complete ' + stageOneStats.passed + '/' + stageOneStats.total);
    console.log('STAGE 2 [EPISODES] complete ' + stageTwoStats.passed + '/' + stageTwoStats.total);
}

main().catch(function handleFatalError(fatalError)
{
    console.log('FATAL ERROR: ' + fatalError.message);
    process.exit(1);
});