const API_KEY = process.env.OMDB_API_KEY;

// Output format follows imdbapi.dev: year, imdbRating and votes are numbers
// (or null when missing); type is always "movie" or "series".

// "movie"/"series" -> the value each API expects on input.
const TYPE_TO_IMDBAPI = { movie: "movie", series: "tvSeries" };

// imdbapi.dev type -> our simple "movie"/"series" for the output.
function normalizeImdbApiType(rawType)
{
    if (rawType === "movie" || rawType === "tvMovie") return "movie";
    if (rawType === "tvSeries" || rawType === "tvMiniSeries") return "series";
    return rawType;
}

async function getImdbRatingKeyLess(title, { year, type } = {}) 
{
    const params = new URLSearchParams({ query: title });
    const url = `https://api.imdbapi.dev/search/titles?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok)
    {
        throw new Error(`Network error: ${response.status}`);
    }
    const data = await response.json();

    let results = data.titles || [];

    if (year)
    {
        results = results.filter((item) => String(item.startYear) === String(year));
    }

    if (type)
    {
        const wantedType = TYPE_TO_IMDBAPI[type] || type;
        results = results.filter((item) => item.type === wantedType);
    }

    const match = results[0];
    if (!match)
    {
        return { error: "Movie or show not found" };
    }

    // Values are returned as-is; "?? null" only guards fields that can be missing.
    return {
    title: match.primaryTitle ?? null,
    year: match.startYear ?? null,
    type: normalizeImdbApiType(match.type),
    imdbRating: match.rating?.aggregateRating ?? null,
    imdbID: match.id ?? null,
    votes: match.rating?.voteCount ?? null,
    };
}

async function getImdbRatingWithKey(title, { year, type } = {})
{
    if (!API_KEY)
    {
        throw new Error("OMDB API key is not set");
    }

    const params = new URLSearchParams({ apikey: API_KEY, t: title });
    if (year) params.append("y", year);
    if (type) params.append("type", type);

    const url = `https://www.omdbapi.com/?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok)
    {
        throw new Error(`Network error: ${response.status}`);
    }
    const data = await response.json();

    if (data.Response !== "True")
    {
        return { error: data.Error };
    }

  // OMDb returns text. Turn rating/votes into numbers; "N/A" means missing.
    const toNumber = (value) => 
    {
        if (value === undefined || value === "N/A") return null;
        const cleaned = String(value).replace(/,/g, ""); // votes look like "2,067,847"
        const parsed = Number(cleaned);
        return Number.isNaN(parsed) ? null : parsed;
    };

// Series come back as a range like "2008-2013" or "2008-"; keep the start year
// to match imdbapi.dev's single startYear number.
    const toYear = (value) => 
    {
        if (!value || value === "N/A") return null;
        const firstYear = String(value).match(/\d+/);
        return firstYear ? Number(firstYear[0]) : null;
    };

  return {
    title: data.Title ?? null,
    year: toYear(data.Year),
    type: data.Type ?? null, // OMDb already uses "movie"/"series"
    imdbRating: toNumber(data.imdbRating),
    imdbID: data.imdbID ?? null,
    votes: toNumber(data.imdbVotes),
  };
}

// Use the keyless version when no key is set, otherwise the one that uses the key.
const getImdbRating = API_KEY ? getImdbRatingWithKey : getImdbRatingKeyLess;

module.exports = { getImdbRating , getImdbRatingWithKey, getImdbRatingKeyLess };