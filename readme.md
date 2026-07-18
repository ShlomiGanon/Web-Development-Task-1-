# Fake Netflix — Streaming Platform

A Netflix-style movie and TV streaming web app built as a course project for **Web Development** by **Shlomi Ganon**.

The system includes a full client UI, a REST API backend, MongoDB storage, per-profile watch history and likes, reviews, and an admin dashboard.

---

## What this project offers

- **Authentication** — Register and log in with client-side validation; optional “Remember me” session persistence
- **Profiles** — Netflix-style “Who’s watching?” screen; create, edit, and delete profiles with name, age, and avatar
- **Browse** — Navigate Home, TV Shows, Movies, New & Popular, and My List; search titles in the current view
- **Playback** — Play movies and series episodes; watch progress is saved; continue watching from the last title
- **Last watched** — Opening media adds it to the profile’s recently watched list (shown as My List)
- **Likes** — Each profile can like content independently
- **Reviews** — Create, edit, and delete episode reviews; read reviews from others
- **Recommendations** — Home shows suggestions based on other profiles on the same account
- **Admin dashboard** — Permission-gated tools to manage users, content, episodes, and reviews, plus visual statistics
- **IMDb / OMDb data** — On content creation, the server can look up ratings and related metadata (requires an API key)

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| Auth | Session tokens (Bearer), bcrypt password hashing |
| Client | Vanilla JavaScript (ES modules), Bootstrap 5 |
| Admin charts | D3 |
| External API | OMDb (IMDb ratings), via `OMDB_API_KEY` |

---

## Setup and run

1. Install dependencies and start the server:

```bash
cd server
npm install
npm start
```

2. Open the app:

```text
http://localhost:3000
```

### Environment variables

Create a `.env` file under `server/` (loaded via `dotenv`):

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string (defaults to `mongodb://localhost:27017/netflix` if unset) |
| `OMDB_API_KEY` | API key for OMDb / IMDb lookups when adding content |
| `PORT` | Server port (default `3000`) |
| `HOST` | Host binding (default `localhost`) |

---

## Website pages

| Page | Path | Description |
|------|------|-------------|
| Entry | `/` (`index.html`) | Checks for an existing session and redirects to profiles or login |
| Login | `/html/login.html` | Sign in |
| Register | `/html/register.html` | Create an account |
| Profiles | `/html/profiles.html` | Choose or manage profiles; logout; admin entry |
| Browse | `/html/profile.html` | Main streaming experience |
| Admin | `/html/admin.html` | Admin dashboard (permission required) |
| More info | `/html/more-info.html` | Project about page (Hebrew) |
| No support | `/html/no-support.html` | Fallback for unsupported actions |

Typical flow: **login / register → pick a profile → browse and watch**.

---

## Server CLI commands

While the server is running, type these commands in the server terminal:

| Command | Description |
|---------|-------------|
| `init` | Deletes all users, profiles, and content, then seeds the database with initial data (asks for confirmation) |
| `setpermission <email> <level>` | Sets a user’s permission level |
| `deletealltokens` | Clears all session tokens |
| `getusers` | Lists all users |
| `getprofiles` | Lists all profiles |
| `getcontent` | Lists all content |
| `closeserver` | Shuts down the server |

---

## Project structure

```text
server/
  config/          # Database connection
  controllers/     # Request handlers (users, profiles, content, reviews, admin, stats)
  middlewares/     # Auth, permissions, profile/content authorization
  models/          # Mongoose models (User, Profile, Content, Episode, Review)
  routes/          # API route definitions
  scripts/         # Seed data, OMDb helper, logging, CLI-related helpers
  public/          # Static client (HTML, CSS, JS, assets)
    html/          # App pages
    js/            # Page scripts + shared UI, session, API client
    css/           # Theme and page styles
    assets/        # Logos, covers, avatars, videos
  server.js        # App entry point + terminal commands
```

---

## Notes

- You must register before you can log in.
- An empty search on the browse page shows all media in the current filter; typing filters by title.
- My List reflects the current profile’s last-watched history, not a separate watchlist API.
- Admin features require a non-zero permission level (use `setpermission` after seeding if needed).
