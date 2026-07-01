const { getImdbRatingKeyLess } = require("../server/scripts/imdb_ranking.js");
const process = require("node:process");
const input_string = process.argv[2];

if (!input_string) 
{
    const script_name = (process.argv[1]).split("\\").pop();
    console.log(`Usage: ${script_name} <movie_name> `);
    process.exit(1);
}

(async () => 
{
    try
    {
        const rating = await getImdbRatingKeyLess(input_string);
        console.log(rating);
    }
    catch (error)
    {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
})();