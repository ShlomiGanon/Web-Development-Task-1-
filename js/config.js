import { FakeBackend } from './BACKEND_API/FakeBackend.js';
export const MAX_LAST_WATCHED_MEDIA_LIMIT = 5;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 16;


// instance of the backend
export const Backend = new FakeBackend();