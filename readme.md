this is a movie streaming platform project
to start the server, run the following command:
```bash
cd server
npm start
```

this project is used env file to store the api key to the imdb api to get the imdb rating of the movies and tv shows.

i hard coded the DB connection string to the mongodb database to store the user and content data.
but if you want to use a different database, you can set in the env file. [MONGO_URI = ....]

to get to the main page, go to the following url:
```bash
http://localhost:3000
```

and we have the following pages:
- login page
- register page
- profiles selection page
- profile page [main page]
- admin dashboard page
- more information page
