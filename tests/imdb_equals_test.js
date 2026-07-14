// Live/integration test -- makes REAL network calls to BOTH providers
// (imdbapi.dev and OMDb). Nothing here is mocked: the goal is to confirm
// the two sources agree on the same data for the same titles.
//
// This whole suite is skipped automatically when OMDB_API_KEY is not set,
// because getImdbRatingWithKey() cannot run without it.
//
// Each title gets its own test()
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MODULE_PATH = path.resolve(__dirname, "../server/scripts/imdb_ranking.js");
const { getImdbRatingKeyLess, getImdbRatingWithKey } = require(MODULE_PATH);

const initialMediaTitles = [
  "Black Rabbit", "Courtroom Queens", "East Side", "Griselda",
  "Nobody Wants This", "Off-Road", "Running Point", "The Spy", "Zero Day",
];

const hasApiKey = Boolean(process.env.OMDB_API_KEY);
const skipReason = "OMDB_API_KEY is not set -- cannot call getImdbRatingWithKey";

describe("both APIs return the same data for initialMediaTitles (live)", () =>
{
  for (const title of initialMediaTitles)
  {
    test(`"${title}": getImdbRatingKeyLess and getImdbRatingWithKey agree`, { skip: !hasApiKey && skipReason }, async () =>
    {
      const [keyLess, withKey] = await Promise.all([
        getImdbRatingKeyLess(title),
        getImdbRatingWithKey(title),
      ]);

      assert.deepEqual(
        keyLess,
        withKey,
        `Mismatch for "${title}":\n  keyless (imdbapi.dev): ${JSON.stringify(keyLess)}\n  withKey (OMDb):        ${JSON.stringify(withKey)}`
      );
    });
  }
});