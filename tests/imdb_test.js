// Verification harness — same assertions as the Jest file, but runnable
// with zero installs via `node --test`. Used only to prove the suite is green.
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MODULE_PATH = path.resolve(__dirname, "../server/scripts/imdb_ranking.js");

// ---- fetch stubbing -------------------------------------------------------
let originalFetch;
beforeEach(() => { originalFetch = global.fetch; });
afterEach(() => { global.fetch = originalFetch; });

const okResponse = (json) => ({ ok: true, status: 200, json: async () => json });
const badResponse = (status) => ({ ok: false, status, json: async () => ({}) });

// Reload the module from scratch with (or without) an API key in the env,
// because API_KEY is captured once at module-load time.
function loadFresh(apiKey) {
  delete require.cache[require.resolve(MODULE_PATH)];
  if (apiKey === undefined) delete process.env.OMDB_API_KEY;
  else process.env.OMDB_API_KEY = apiKey;
  return require(MODULE_PATH);
}

// ---- fixtures -------------------------------------------------------------
const imdbApiHit = {
  id: "tt15469618",
  primaryTitle: "Griselda",
  startYear: 2024,
  type: "tvMiniSeries",
  rating: { aggregateRating: 7.4, voteCount: 52000 },
};

const initialMediaTitles = [
  "Black Rabbit", "Courtroom Queens", "East Side", "Griselda",
  "Nobody Wants This", "Off-Road", "Running Point", "The Spy", "Zero Day",
];

// ===========================================================================
describe("getImdbRatingKeyLess", () => {
  let getImdbRatingKeyLess;
  beforeEach(() => { ({ getImdbRatingKeyLess } = loadFresh(undefined)); });

  test("maps an imdbapi.dev hit to the normalized shape", async () => {
    global.fetch = async () => okResponse({ titles: [imdbApiHit] });
    const out = await getImdbRatingKeyLess("Griselda");
    assert.deepEqual(out, {
      title: "Griselda",
      year: 2024,
      type: "series",          // tvMiniSeries -> series
      imdbRating: 7.4,
      imdbID: "tt15469618",
      votes: 52000,
    });
  });

  test("queries the search endpoint with the title", async () => {
    let calledUrl;
    global.fetch = async (url) => { calledUrl = url; return okResponse({ titles: [imdbApiHit] }); };
    await getImdbRatingKeyLess("Griselda");
    assert.match(calledUrl, /^https:\/\/api\.imdbapi\.dev\/search\/titles\?/);
    assert.match(calledUrl, /query=Griselda/);
  });

  test("filters by year and keeps the matching entry", async () => {
    global.fetch = async () => okResponse({ titles: [
      { ...imdbApiHit, startYear: 1999, primaryTitle: "Old" },
      { ...imdbApiHit, startYear: 2024, primaryTitle: "New" },
    ]});
    const out = await getImdbRatingKeyLess("Griselda", { year: 2024 });
    assert.equal(out.title, "New");
  });

  test("filters by type, mapping series -> tvSeries", async () => {
    global.fetch = async () => okResponse({ titles: [
      { ...imdbApiHit, type: "movie", primaryTitle: "AsMovie" },
      { ...imdbApiHit, type: "tvSeries", primaryTitle: "AsSeries" },
    ]});
    const out = await getImdbRatingKeyLess("X", { type: "series" });
    assert.equal(out.title, "AsSeries");
    assert.equal(out.type, "series");
  });

  test("filters by type, mapping movie -> movie", async () => {
    global.fetch = async () => okResponse({ titles: [
      { ...imdbApiHit, type: "tvSeries", primaryTitle: "AsSeries" },
      { ...imdbApiHit, type: "movie", primaryTitle: "AsMovie" },
    ]});
    const out = await getImdbRatingKeyLess("X", { type: "movie" });
    assert.equal(out.title, "AsMovie");
    assert.equal(out.type, "movie");
  });

  test("returns an error object when nothing matches", async () => {
    global.fetch = async () => okResponse({ titles: [] });
    assert.deepEqual(await getImdbRatingKeyLess("Nope"), { error: "Movie or show not found" });
  });

  test("returns an error object when filters remove every result", async () => {
    global.fetch = async () => okResponse({ titles: [{ ...imdbApiHit, startYear: 2024 }] });
    assert.deepEqual(await getImdbRatingKeyLess("Griselda", { year: 1980 }),
      { error: "Movie or show not found" });
  });

  test("treats a missing titles array as no results", async () => {
    global.fetch = async () => okResponse({});
    assert.deepEqual(await getImdbRatingKeyLess("Nope"), { error: "Movie or show not found" });
  });

  test("throws on a non-ok network response", async () => {
    global.fetch = async () => badResponse(503);
    await assert.rejects(() => getImdbRatingKeyLess("Griselda"), /Network error: 503/);
  });

  test("nulls out missing rating fields", async () => {
    global.fetch = async () => okResponse({ titles: [
      { id: "tt1", primaryTitle: "No Rating", startYear: 2020, type: "movie" }, // no rating object
    ]});
    const out = await getImdbRatingKeyLess("No Rating");
    assert.equal(out.imdbRating, null);
    assert.equal(out.votes, null);
  });

  test("normalizes tvMovie -> movie", async () => {
    global.fetch = async () => okResponse({ titles: [{ ...imdbApiHit, type: "tvMovie" }] });
    assert.equal((await getImdbRatingKeyLess("X")).type, "movie");
  });

  describe("over the initialMedia titles", () => {
    for (const title of initialMediaTitles) {
      test(`resolves "${title}"`, async () => {
        const expectedQuery = new URLSearchParams({ query: title }).toString();
        global.fetch = async (url) => {
          assert.ok(url.includes(expectedQuery), `URL should contain ${expectedQuery}`);
          return okResponse({ titles: [{ ...imdbApiHit, primaryTitle: title }] });
        };
        const out = await getImdbRatingKeyLess(title);
        assert.equal(out.title, title);
        assert.equal(out.type, "series");
        assert.equal(typeof out.imdbRating, "number");
      });
    }
  });
});

// ===========================================================================
describe("getImdbRatingWithKey", () => {
  const omdbHit = {
    Response: "True",
    Title: "Sherlock",
    Year: "2010-2017",
    Type: "series",
    imdbRating: "9.1",
    imdbID: "tt1475582",
    imdbVotes: "1,000,500",
  };

  test("throws when no API key is configured", async () => {
    const { getImdbRatingWithKey } = loadFresh(undefined);
    await assert.rejects(() => getImdbRatingWithKey("Sherlock"), /OMDB API key is not set/);
  });

  describe("with a key set", () => {
    let getImdbRatingWithKey;
    beforeEach(() => { ({ getImdbRatingWithKey } = loadFresh("test-key")); });

    test("maps an OMDb hit, parsing numbers and the start year", async () => {
      global.fetch = async () => okResponse(omdbHit);
      assert.deepEqual(await getImdbRatingWithKey("Sherlock"), {
        title: "Sherlock",
        year: 2010,            // "2010-2017" -> 2010
        type: "series",
        imdbRating: 9.1,
        imdbID: "tt1475582",
        votes: 1000500,        // "1,000,500" -> 1000500
      });
    });

    test("sends apikey + title, and appends y/type when given", async () => {
      let calledUrl;
      global.fetch = async (url) => { calledUrl = url; return okResponse(omdbHit); };
      await getImdbRatingWithKey("Sherlock", { year: 2010, type: "series" });
      assert.match(calledUrl, /^https:\/\/www\.omdbapi\.com\/\?/);
      assert.match(calledUrl, /apikey=test-key/);
      assert.match(calledUrl, /t=Sherlock/);
      assert.match(calledUrl, /y=2010/);
      assert.match(calledUrl, /type=series/);
    });

    test("does not append y/type when omitted", async () => {
      let calledUrl;
      global.fetch = async (url) => { calledUrl = url; return okResponse(omdbHit); };
      await getImdbRatingWithKey("Sherlock");
      assert.doesNotMatch(calledUrl, /[?&]y=/);
      assert.doesNotMatch(calledUrl, /[?&]type=/);
    });

    test("returns the OMDb error when Response is not True", async () => {
      global.fetch = async () => okResponse({ Response: "False", Error: "Movie not found!" });
      assert.deepEqual(await getImdbRatingWithKey("Nope"), { error: "Movie not found!" });
    });

    test("keeps the open start year for an ongoing series (\"2008-\")", async () => {
      global.fetch = async () => okResponse({ ...omdbHit, Year: "2008-" });
      assert.equal((await getImdbRatingWithKey("X")).year, 2008);
    });

    test("turns N/A rating and votes into null", async () => {
      global.fetch = async () => okResponse({ ...omdbHit, imdbRating: "N/A", imdbVotes: "N/A" });
      const out = await getImdbRatingWithKey("X");
      assert.equal(out.imdbRating, null);
      assert.equal(out.votes, null);
    });

    test("nulls a year of \"N/A\"", async () => {
      global.fetch = async () => okResponse({ ...omdbHit, Year: "N/A" });
      assert.equal((await getImdbRatingWithKey("X")).year, null);
    });

    test("throws on a non-ok network response", async () => {
      global.fetch = async () => badResponse(500);
      await assert.rejects(() => getImdbRatingWithKey("X"), /Network error: 500/);
    });
  });
});

// ===========================================================================
describe("getImdbRating dispatcher", () => {
  test("is the keyless variant when no key is set", () => {
    const m = loadFresh(undefined);
    assert.equal(m.getImdbRating, m.getImdbRatingKeyLess);
  });
  test("is the keyed variant when a key is set", () => {
    const m = loadFresh("test-key");
    assert.equal(m.getImdbRating, m.getImdbRatingWithKey);
  });
});