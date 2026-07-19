import { HttpClient } from './api/http-client.js';

// Single source of truth for client-side constants.

// Shared backend client instance used across the client.
export const Backend = new HttpClient();

// Number of selectable avatar images (profile1.png..profileN.png) on disk.
// NOTE: this is the avatar catalog size, not the per-account profile limit (that lives server-side).
export const AVAILABLE_PROFILE_IMAGES_COUNT = 15;
export const AVAILABLE_PROFILES_IMAGES = Array.from({ length: AVAILABLE_PROFILE_IMAGES_COUNT }, (_, i) => `profile${i + 1}.png`);

export const MAX_LAST_WATCHED_MEDIA_LIMIT = 5;
export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 16;
