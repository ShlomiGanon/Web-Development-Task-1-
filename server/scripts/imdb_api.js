const API_KEY = process.env.OMDB_API_KEY;

// --- Rating -> age mapping ---

// Maps OMDb content ratings (MPAA/TV) to a minimum recommended viewer age.
// Ratings with no clear age equivalent (Not Rated/Unrated/N/A) resolve to null.
const RATING_TO_AGE_LIMIT = 
{
    "G": 0, "TV-G": 0, "TV-Y": 0, "TV-Y7": 7,
    "PG": 7, "TV-PG": 10, "PG-13": 13, "TV-14": 14,
    "R": 17, "TV-MA": 17, "NC-17": 18,
};

// --- Main API call ---

/**
 * Fetches title info from OMDb using the API key.
 * @param {string} title
 * @param {object} [options]
 * @param {number} [options.year]
 * @param {"movie"|"series"} [options.type]
 * @returns {Promise<object>} title data (numbers/arrays are null when missing),
 *          or { error } if OMDb found no match.
 */
async function IMDB_API_INFO(title, { year, type } = {})
{
    if (!API_KEY)
    {
        throw new Error("OMDB API key is not set");
    }

    const params = new URLSearchParams({ apikey: API_KEY, t: title, plot: "short" });
    if (year) params.append("y", year);
    if (type) params.append("type", type);

    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
    if (!response.ok)
    {
        const body = await response.text().catch(() => "");
        throw new Error(`Network error: ${response.status} - ${body}`);
    }
    const data = await response.json();

    if (data.Response !== "True")
    {
        return { error: data.Error };
    }

    return {
        title: data.Title ?? null,
        year: toYear(data.Year),
        type: data.Type ?? null,
        imdbRating: toNumber(data.imdbRating),
        imdbID: data.imdbID ?? null,
        votes: toNumber(data.imdbVotes),
        actors: toList(data.Actors),
        description: data.Plot && data.Plot !== "N/A" ? data.Plot : null,
        categories: toList(data.Genre),
        age_limit: toAgeLimit(data.Rated),
        poster_url: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    };
}

// --- OMDb field parsers ---
// OMDb returns everything as text, using "N/A" for missing values.

// "2,067,847" / imdbRating -> number, or null
function toNumber(value)
{
    if (value === undefined || value === "N/A") return null;
    const parsed = Number(String(value).replace(/,/g, ""));
    return Number.isNaN(parsed) ? null : parsed;
}

// "2008-2013" / "2008-" -> start year as a number, or null
function toYear(value)
{
    if (!value || value === "N/A") return null;
    const firstYear = String(value).match(/\d+/);
    return firstYear ? Number(firstYear[0]) : null;
}

// Comma-separated string (Actors/Genre) -> array of strings, or null
function toList(value)
{
    if (!value || value === "N/A") return null;
    return value.split(",").map((v) => v.trim()).filter(Boolean);
}

// Content rating (Rated) -> minimum age via RATING_TO_AGE_LIMIT, or null
function toAgeLimit(value)
{
    if (!value || value === "N/A") return null;
    return RATING_TO_AGE_LIMIT[value] ?? null;
}

module.exports = { IMDB_API_INFO };