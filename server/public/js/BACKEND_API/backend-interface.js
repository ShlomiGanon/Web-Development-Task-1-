import * as Constants from '../constances.js';

// ==========================================
//                 Profile
// ==========================================

export class Profile
{
    /**
     * @param {string} id
     * @param {string} profileName
     * @param {number} [age=0]
     * @param {string} [ImageName]
     * @param {Array<{episode_id: string, content_id: string, position_seconds: number}>} [lastWatched=[]] - one entry per watched content, no `_id` field. position_seconds is how many seconds into that episode the profile last stopped at.
     * @param {Set<string>|Array<string>} [likedContentIds=[]]
     */
    constructor(id, profileName, age = 0, ImageName, lastWatched = [], likedContentIds = [])
    {
        this.id = id;
        this.profileName = profileName;
        this.age = age;
        this.ImageName = ImageName;
        this.lastWatched = Array.isArray(lastWatched) ? lastWatched : [];

        if (likedContentIds instanceof Set)
        {
            this.likedContentIds = likedContentIds;
        }
        else
        {
            const rawLikeIDs = Array.isArray(likedContentIds) ? likedContentIds : [];
            this.likedContentIds = new Set(rawLikeIDs);
        }
    }

    /** Returns a copy with any of the given fields overridden. */
    clone(overrides = {})
    {
        return new Profile(
            overrides.id ?? this.id,
            overrides.profileName ?? this.profileName,
            overrides.age ?? this.age,
            overrides.ImageName ?? this.ImageName,
            overrides.lastWatched ?? this.lastWatched,
            overrides.likedContentIds ?? this.likedContentIds
        );
    }

    /**
     * Parses a backend Profile. Lightweight endpoints only send { id, profileName, age,
     * ImageName }; only GET .../details also sends likedContentIds and lastWatched (each
     * lastWatched entry includes position_seconds).
     * @param {Object} rawObject
     * @returns {Profile|null}
     */
    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Profile) return rawObject;

        return new Profile(
            rawObject.id,
            rawObject.profileName,
            rawObject.age,
            rawObject.ImageName,
            rawObject.lastWatched ?? [],
            rawObject.likedContentIds ?? []
        );
    }

    /**
     * Body for PUT /profile/:profileId. id/lastWatched/likedContentIds are never sent here -
     * those change only via their own dedicated routes.
     */
    toJSON()
    {
        return {
            profileName: this.profileName,
            age: this.age,
            ImageName: this.ImageName
        };
    }

    /** One entry of PUT /profile/'s `updates` array (needs profileId alongside the changes). */
    toBulkUpdateEntry()
    {
        return {
            profileId: this.id,
            ...this.toJSON()
        };
    }

    updateLastWatched(newLastWatched)
    {
        this.lastWatched = Array.isArray(newLastWatched) ? newLastWatched : [];
    }

    updateLikedContentIds(newLikedContentIds)
    {
        if (newLikedContentIds instanceof Set)
        {
            this.likedContentIds = newLikedContentIds;
        }
        else
        {
            const rawLikeIDs = Array.isArray(newLikedContentIds) ? newLikedContentIds : [];
            this.likedContentIds = new Set(rawLikeIDs);
        }
    }
}

// ==========================================
//                UserInfo
// ==========================================

export class UserInfo
{
    /**
     * "Safe user" shape: { id, email, phone, fullName, birthday, createdAt, permission_level }.
     * No endpoint returns profiles bundled with the user - fetch them separately via Profile routes.
     * @param {string} id
     * @param {string} email
     * @param {string} phone
     * @param {string} fullName
     * @param {Date} [birthday]
     * @param {Date} [createdAt]
     * @param {Array<Profile|Object>} [rawProfiles=[]]
     * @param {number} [permission_level]
     */
    constructor(id, email, phone, fullName, birthday, createdAt, rawProfiles = [], permission_level = undefined)
    {
        this.id = id;
        this.email = email;
        this.phone = phone;
        this.fullName = fullName;
        this.birthday = new Date(birthday);
        this.createdAt = new Date(createdAt);
        this.profiles = rawProfiles.map(p => p instanceof Profile ? p : Profile.fromJSON(p));
        this.permission_level = permission_level;
    }

    /** Returns a copy with any of the given fields overridden. */
    clone(overrides = {})
    {
        return new UserInfo(
            overrides.id ?? this.id,
            overrides.email ?? this.email,
            overrides.phone ?? this.phone,
            overrides.fullName ?? this.fullName,
            overrides.birthday ?? this.birthday,
            overrides.createdAt ?? this.createdAt,
            overrides.profiles ?? this.profiles,
            overrides.permission_level ?? this.permission_level
        );
    }

    /** Parses a backend "safe user" response. */
    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof UserInfo) return rawObject;
        return new UserInfo(
            rawObject.id,
            rawObject.email,
            rawObject.phone,
            rawObject.fullName,
            rawObject.birthday,
            rawObject.createdAt,
            rawObject.profiles ?? [],
            rawObject.permission_level
        );
    }

    /**
     * Body for PUT /user/me or PUT /admin/users/:user_id. id/createdAt/permission_level are
     * read-only, and profiles is never part of this payload. Add `password` yourself if changing it.
     */
    toJSON()
    {
        return {
            email: this.email,
            phone: this.phone,
            fullName: this.fullName,
            birthday: this.birthday instanceof Date ? this.birthday.toISOString() : this.birthday
        };
    }
}

// ==========================================
//               ContentItem
// ==========================================

export class ContentItem
{
    /**
     * videoUrl lives on Episode, not here. average_rating/review_count are read-only,
     * kept in sync by the review endpoints. imdb_rating/imdb_votes/actors are also
     * read-only - set once from IMDB at creation time, never re-fetched afterward.
     * res.content shape (all content-returning endpoints): id, title, description,
     * cover_image_name, type, categories, release_date, age_limit, likes, createdAt,
     * average_rating, review_count, imdb_rating, imdb_votes, actors.
     */
    constructor(id, title, cover_image_name, likes = 0, type, categories = [], description, age_limit = 0, release_date, createdAt, imdb_rating = null, imdb_votes = null, actors = [], average_rating = 0, review_count = 0)
    {
        this.id = id;
        this.title = title;
        this.cover_image_name = cover_image_name;
        this.likes = likes;
        this.type = type;
        this.categories = Array.isArray(categories) ? categories : [];
        this.description = description;
        this.age_limit = age_limit;
        this.release_date = new Date(release_date);
        this.createdAt = new Date(createdAt);
        this.imdb_rating = imdb_rating;
        this.imdb_votes = imdb_votes;
        this.actors = Array.isArray(actors) ? actors : [];
        this.average_rating = average_rating;
        this.review_count = review_count;
    }

    /** Returns a copy with any of the given fields overridden. */
    clone(overrides = {})
    {
        return new ContentItem(
            overrides.id ?? this.id,
            overrides.title ?? this.title,
            overrides.cover_image_name ?? this.cover_image_name,
            overrides.likes ?? this.likes,
            overrides.type ?? this.type,
            overrides.categories ?? this.categories,
            overrides.description ?? this.description,
            overrides.age_limit ?? this.age_limit,
            overrides.release_date ?? this.release_date,
            overrides.createdAt ?? this.createdAt,
            overrides.imdb_rating ?? this.imdb_rating,
            overrides.imdb_votes ?? this.imdb_votes,
            overrides.actors ?? this.actors,
            overrides.average_rating ?? this.average_rating,
            overrides.review_count ?? this.review_count
        );
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof ContentItem) return rawObject;

        return new ContentItem(
            rawObject.id,
            rawObject.title,
            rawObject.cover_image_name,
            rawObject.likes,
            rawObject.type,
            rawObject.categories,
            rawObject.description,
            rawObject.age_limit,
            rawObject.release_date,
            rawObject.createdAt,
            rawObject.imdb_rating,
            rawObject.imdb_votes,
            rawObject.actors,
            rawObject.average_rating,
            rawObject.review_count
        );
    }

    /**
     * Body for POST/PUT /admin/content. Read-only fields (id, likes, createdAt, ratings,
     * imdb_rating, imdb_votes) are omitted. actors is included since the server accepts it
     * as an optional field on creation (falls back to an IMDB lookup if left empty there).
     */
    toJSON()
    {
        return {
            title: this.title,
            type: this.type,
            release_date: this.release_date instanceof Date ? this.release_date.toISOString() : this.release_date,
            description: this.description,
            cover_image_name: this.cover_image_name,
            categories: this.categories,
            age_limit: this.age_limit,
            actors: this.actors
        };
    }
}

// ==========================================
//                 Episode
// ==========================================

export class Episode
{
    /**
     * Every watchable item is an Episode, including a movie's single video (season 1, episode 1).
     * @param {string} id
     * @param {string} contentId
     * @param {number} seasonNumber
     * @param {number} episodeNumber
     * @param {string} title
     * @param {string} videoUrl
     */
    constructor(id, contentId, seasonNumber, episodeNumber, title, videoUrl)
    {
        this.id = id;
        this.contentId = contentId;
        this.seasonNumber = seasonNumber;
        this.episodeNumber = episodeNumber;
        this.title = title;
        this.videoUrl = videoUrl;
    }

    /** Returns a copy with any of the given fields overridden. */
    clone(overrides = {})
    {
        return new Episode(
            overrides.id ?? this.id,
            overrides.contentId ?? this.contentId,
            overrides.seasonNumber ?? this.seasonNumber,
            overrides.episodeNumber ?? this.episodeNumber,
            overrides.title ?? this.title,
            overrides.videoUrl ?? this.videoUrl
        );
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Episode) return rawObject;

        return new Episode(
            rawObject.id,
            rawObject.contentId,
            rawObject.seasonNumber,
            rawObject.episodeNumber,
            rawObject.title,
            rawObject.videoUrl
        );
    }

    /**
     * Body for POST/PUT episode admin routes. NOTE: server reads season_number/episode_number
     * (snake_case) but returns seasonNumber/episodeNumber (camelCase) - this converts.
     * id/contentId are not sent (URL path / read-only).
     */
    toJSON()
    {
        return {
            season_number: this.seasonNumber,
            episode_number: this.episodeNumber,
            title: this.title,
            videoUrl: this.videoUrl
        };
    }
}

// ==========================================
//                 Review
// ==========================================

export class Review
{
    /**
     * One profile's rating (1-10) + optional comment, for one episode. Max one review per
     * profile per episode. reviewerName is server-computed and read-only - not sent back
     * via toJSON().
     * @param {string} id
     * @param {string} contentId
     * @param {string} episodeId
     * @param {string} profileId
     * @param {number} rating
     * @param {string} [comment]
     * @param {string} [reviewerName]
     */
    constructor(id, contentId, episodeId, profileId, rating, comment, reviewerName)
    {
        this.id = id;
        this.contentId = contentId;
        this.episodeId = episodeId;
        this.profileId = profileId;
        this.rating = rating;
        this.comment = comment;
        this.reviewerName = reviewerName;
    }

    /** Returns a copy with any of the given fields overridden. */
    clone(overrides = {})
    {
        return new Review(
            overrides.id ?? this.id,
            overrides.contentId ?? this.contentId,
            overrides.episodeId ?? this.episodeId,
            overrides.profileId ?? this.profileId,
            overrides.rating ?? this.rating,
            overrides.comment ?? this.comment,
            overrides.reviewerName ?? this.reviewerName
        );
    }

    static fromJSON(rawObject)
    {
        if (!rawObject) return null;
        if (rawObject instanceof Review) return rawObject;

        return new Review(
            rawObject.id,
            rawObject.contentId,
            rawObject.episodeId,
            rawObject.profileId,
            rawObject.rating,
            rawObject.comment,
            rawObject.reviewerName
        );
    }

    /** Body for review write routes. id/contentId/episodeId/profileId/reviewerName are read-only. */
    toJSON()
    {
        return {
            rating: this.rating,
            comment: this.comment
        };
    }
}

/**
 * Abstract interface for the Backend API - one method per route, grouped by resource.
 */
export class Interface_BackendAPI
{
    constructor()
    {
        if (this.constructor === Interface_BackendAPI)
        {
            throw new Error("Cannot instantiate Abstract Class 'Interface_BackendAPI' directly.");
        }
    }

    // ==========================================
    //         User Routes (public/self)
    // ==========================================

    /** POST /user/register with { email, phone, password, fullName, birthday }. */
    async register(email, phone, password, fullName, birthday)
    {
        throw new Error("Method 'register()' must be implemented.");
    }

    /** POST /user/login with { email_or_phone, password }. */
    async login(email_or_phone, password)
    {
        throw new Error("Method 'login()' must be implemented.");
    }

    /** POST /user/logout. No body. */
    async logout(sessionToken)
    {
        throw new Error("Method 'logout()' must be implemented.");
    }

    /** GET /user/me. */
    async fetchActiveUserInfo(sessionToken)
    {
        throw new Error("Method 'fetchActiveUserInfo()' must be implemented.");
    }

    /** PUT /user/me with { password?, email?, phone?, fullName?, birthday? } (see UserInfo.toJSON). */
    async updateActiveUserInfo(sessionToken, changes)
    {
        throw new Error("Method 'updateActiveUserInfo()' must be implemented.");
    }

    // ==========================================
    //   Admin Routes - Users (/api/admin/users)
    // ==========================================

    /**
     * GET /admin/users. Query: email_contains, phone_contains, fullname_contains,
     * born_after/before, joined_after/before, limit, skip, sort, sortOrder.
     * sort is whitelisted to createdAt/birthday/fullName/email only (unique to this endpoint).
     */
    async searchUsers(sessionToken, queryParams = {})
    {
        throw new Error("Method 'searchUsers()' must be implemented.");
    }

    /** GET /admin/users/:user_id. */
    async fetchUserById(sessionToken, userId)
    {
        throw new Error("Method 'fetchUserById()' must be implemented.");
    }

    /** PUT /admin/users/:user_id - same shape as updateActiveUserInfo(). */
    async updateUserById(sessionToken, userId, changes)
    {
        throw new Error("Method 'updateUserById()' must be implemented.");
    }

    /** DELETE /admin/users/:user_id (super admin only). Cascades to profiles/reviews. */
    async deleteUser(sessionToken, userId)
    {
        throw new Error("Method 'deleteUser()' must be implemented.");
    }

    /**
     * PUT /admin/users/:user_id/permission with { permission_level } (0=USER, 1=ADMIN, 2=SUPER_ADMIN).
     * Can't assign above own level or act on someone already above own level; same-level allowed.
     */
    async setUserPermissionLevel(sessionToken, userId, permissionLevel)
    {
        throw new Error("Method 'setUserPermissionLevel()' must be implemented.");
    }

    /** GET /admin/users/:user_id/tokens_count. Response has no `message` on success. */
    async getUserTokensCount(sessionToken, userId)
    {
        throw new Error("Method 'getUserTokensCount()' must be implemented.");
    }

    /** GET /admin/profiles/:profileId/owner - finds the user owning a profile. */
    async findUserByProfileId(sessionToken, profileId)
    {
        throw new Error("Method 'findUserByProfileId()' must be implemented.");
    }

    /** POST /admin/users/:user_id/kick. Response is only { success }. */
    async kickUser(sessionToken, userId)
    {
        throw new Error("Method 'kickUser()' must be implemented.");
    }

    /**
     * POST /admin/users/:user_id/ban with { hours_to_ban }. Doesn't kick existing sessions.
     * Server does not clamp hours_to_ban - validate on the client if needed. Response is only { success }.
     */
    async banUser(sessionToken, userId, hoursToBan)
    {
        throw new Error("Method 'banUser()' must be implemented.");
    }

    /** GET /admin/users/:user_id/ban. Response is only { success, is_banned }. */
    async isUserBanned(sessionToken, userId)
    {
        throw new Error("Method 'isUserBanned()' must be implemented.");
    }

    // ==========================================
    //              Profile Routes
    // ==========================================

    /** POST /profile/. No body. Fails if the server's max profile count is reached. */
    async createProfile(sessionToken)
    {
        throw new Error("Method 'createProfile()' must be implemented.");
    }

    /** GET /profile/ - all profiles of the logged-in user. */
    async fetchAllProfiles(sessionToken)
    {
        throw new Error("Method 'fetchAllProfiles()' must be implemented.");
    }

    /** GET /profile/:profileId - lightweight summary only. */
    async fetchProfileById(sessionToken, profileId)
    {
        throw new Error("Method 'fetchProfileById()' must be implemented.");
    }

    /** GET /profile/:profileId/details - includes likedContentIds and lastWatched (each entry has position_seconds). */
    async fetchProfileDetails(sessionToken, profileId)
    {
        throw new Error("Method 'fetchProfileDetails()' must be implemented.");
    }

    /** PUT /profile/:profileId with profile.toJSON(). Returns the caller's full profile list. */
    async updateProfile(sessionToken, profileId, changes)
    {
        throw new Error("Method 'updateProfile()' must be implemented.");
    }

    /** PUT /profile/ with { updates: [profile.toBulkUpdateEntry(), ...] }. Unknown profileIds are skipped silently. */
    async saveProfiles(sessionToken, updates)
    {
        throw new Error("Method 'saveProfiles()' must be implemented.");
    }

    /** DELETE /profile/:profileId. Fails if it's the user's last remaining profile. */
    async deleteProfile(sessionToken, profileId)
    {
        throw new Error("Method 'deleteProfile()' must be implemented.");
    }

    /** POST /profile/:profileId/likes/:contentId - toggles a like. */
    async toggleContentLike(sessionToken, profileId, contentId)
    {
        throw new Error("Method 'toggleContentLike()' must be implemented.");
    }

    /**
     * POST /profile/:profileId/watch/:contentId - resumes saved episode or starts at S1E1.
     * position_seconds on the returned lastWatched entry is only carried over from before
     * when this resumes the same episode that was already tracked - otherwise it starts at 0.
     */
    async recordWatch(sessionToken, profileId, contentId)
    {
        throw new Error("Method 'recordWatch()' must be implemented.");
    }

    /**
     * POST /profile/:profileId/watch/:contentId/:episodeId - records this specific episode.
     * Same position_seconds carry-over rule as recordWatch(): only kept if episodeId matches
     * what was already tracked for this content, otherwise it starts at 0.
     */
    async recordWatchEpisode(sessionToken, profileId, contentId, episodeId)
    {
        throw new Error("Method 'recordWatchEpisode()' must be implemented.");
    }

    /**
     * Maps to POST /profile/:profileId/watch/:contentId/:episodeId/progress with { position_seconds }.
     * Updates just the in-episode playback position for an episode already tracked in the
     * profile's watch history.
     * @param {string} sessionToken
     * @param {string} profileId
     * @param {string} contentId
     * @param {string} episodeId
     * @param {number} positionSeconds
     * @returns {Promise<{success: boolean, message?: string, positionSeconds?: number}>}
     */
    async updateWatchProgress(sessionToken, profileId, contentId, episodeId, positionSeconds)
    {
        throw new Error("Method 'updateWatchProgress()' must be implemented.");
    }

    /** GET /profile/:profileId/other_profiles_recommendations. */
    async getOtherProfilesRecommendations(sessionToken, profileId)
    {
        throw new Error("Method 'getOtherProfilesRecommendations()' must be implemented.");
    }

    /** GET /profile/:profileId/top_picks. Empty list (not an error) if no history yet. */
    async getTopPicks(sessionToken, profileId)
    {
        throw new Error("Method 'getTopPicks()' must be implemented.");
    }

    // ==========================================
    //         Content Routes (public)
    // ==========================================

    /** GET /content/:contentId. */
    async getContentByID(contentId)
    {
        throw new Error("Method 'getContentByID()' must be implemented.");
    }

    /**
     * GET /content/. Query: title_contains, exact/contain/exclude_category, type,
     * released_after/before, min/max_age_limit, min_likes, limit, skip, sort, sortOrder.
     * sort has no whitelist here (unlike searchUsers()).
     */
    async getAllContentItems(queryParams = {})
    {
        throw new Error("Method 'getAllContentItems()' must be implemented.");
    }

    /** GET /content/:contentId/episodes (series only). seasons[0] = season 1, etc. */
    async getContentEpisodes(contentId)
    {
        throw new Error("Method 'getContentEpisodes()' must be implemented.");
    }

    /** GET /content/:contentId/episodes/:episodeId. */
    async getEpisodeById(contentId, episodeId)
    {
        throw new Error("Method 'getEpisodeById()' must be implemented.");
    }

    /** GET .../episodes/:episodeId/next. `episode` absent if this was the last one. */
    async getNextEpisode(contentId, episodeId)
    {
        throw new Error("Method 'getNextEpisode()' must be implemented.");
    }

    /** GET .../episodes/:episodeId/prev. `episode` absent if this was the first one. */
    async getPrevEpisode(contentId, episodeId)
    {
        throw new Error("Method 'getPrevEpisode()' must be implemented.");
    }

    // ==========================================
    //  Admin Routes - Content (/api/admin/content)
    // ==========================================

    /** POST /admin/content. Required: title, type, release_date. Build with contentItem.toJSON(). */
    async createContent(sessionToken, contentData)
    {
        throw new Error("Method 'createContent()' must be implemented.");
    }

    /** PUT /admin/content/:contentId. */
    async updateContent(sessionToken, contentId, changes)
    {
        throw new Error("Method 'updateContent()' must be implemented.");
    }

    /** DELETE /admin/content/:contentId. Does not cascade to that content's reviews. */
    async deleteContent(sessionToken, contentId)
    {
        throw new Error("Method 'deleteContent()' must be implemented.");
    }

    /** POST /admin/content/:contentId/episodes (series only). Build with episode.toJSON(). */
    async addEpisode(sessionToken, contentId, episodeData)
    {
        throw new Error("Method 'addEpisode()' must be implemented.");
    }

    /** PUT /admin/content/:contentId/movie-video with { videoUrl } (movies only). */
    async setMovieVideo(sessionToken, contentId, videoUrl)
    {
        throw new Error("Method 'setMovieVideo()' must be implemented.");
    }

    /** PUT /admin/content/:contentId/episodes/:episodeId. Build with episode.toJSON(). */
    async updateEpisode(sessionToken, contentId, episodeId, changes)
    {
        throw new Error("Method 'updateEpisode()' must be implemented.");
    }

    /** DELETE /admin/content/:contentId/episodes/:episodeId. Leaves dangling refs elsewhere. */
    async deleteEpisode(sessionToken, contentId, episodeId)
    {
        throw new Error("Method 'deleteEpisode()' must be implemented.");
    }

    // ==========================================
    //           Review Routes (/api/reviews)
    // ==========================================

    /** POST /reviews/:profileId/:contentId/:episodeId. One review per profile per episode. */
    async addReview(sessionToken, profileId, contentId, episodeId, rating, comment)
    {
        throw new Error("Method 'addReview()' must be implemented.");
    }

    /** PUT /reviews/:profileId/:contentId/:episodeId. Build with review.toJSON(). */
    async updateReview(sessionToken, profileId, contentId, episodeId, changes)
    {
        throw new Error("Method 'updateReview()' must be implemented.");
    }

    /** DELETE /reviews/:profileId/:contentId/:episodeId. */
    async deleteReview(sessionToken, profileId, contentId, episodeId)
    {
        throw new Error("Method 'deleteReview()' must be implemented.");
    }

    /**
     * GET /reviews/ (public). Query: content_id, episode_id, profile_id, user_id, rating,
     * min/max_rating, comment_starts/ends/contains, limit, skip, sort, sortOrder. No sort whitelist.
     */
    async searchReviews(queryParams = {})
    {
        throw new Error("Method 'searchReviews()' must be implemented.");
    }

    // ==========================================
    //  Admin Routes - Reviews (/api/admin/reviews)
    // ==========================================

    /** PUT /admin/reviews/:reviewId. Build with review.toJSON(). */
    async adminUpdateReview(sessionToken, reviewId, changes)
    {
        throw new Error("Method 'adminUpdateReview()' must be implemented.");
    }

    /** DELETE /admin/reviews/:reviewId. */
    async adminDeleteReview(sessionToken, reviewId)
    {
        throw new Error("Method 'adminDeleteReview()' must be implemented.");
    }

    // ==========================================
    //  Admin Routes - Statistics (/api/admin/*-statistics)
    // ==========================================

    /**
     * GET /admin/users-statistics. statistics: profileDistribution (1..max profiles),
     * userGrowth (last 6 months), ageDistribution (Under 18/Invalid, 18-24, 25-34, 35-44, 45-59, 60-89, 90+).
     */
    async getUsersStatistics(sessionToken)
    {
        throw new Error("Method 'getUsersStatistics()' must be implemented.");
    }

    /**
     * GET /admin/content-statistics. statistics: categoryDistribution, episodesPerSeriesStats
     * (average + buckets 0, 1-4, 5-9, 10-19, 20-49, 50+), ageDistribution (Invalid, 0-6, 7-12, 13-15, 16-17, 18+).
     */
    async getContentStatistics(sessionToken)
    {
        throw new Error("Method 'getContentStatistics()' must be implemented.");
    }

    /**
     * GET /admin/reviews-statistics. statistics: ratingDistribution (1-10),
     * categoryAverageRating, monthlyAverageRating (last 6 months).
     */
    async getReviewsStatistics(sessionToken)
    {
        throw new Error("Method 'getReviewsStatistics()' must be implemented.");
    }
}