

import { HttpClient } from './BACKEND_API/HttpClient.js';
import { FakeBackend } from './BACKEND_API/FakeBackend.js';
export const MAX_PROFILES_COUNT = 15;
// instance of the backend
export const Backend = new FakeBackend();
export const AVAILABLE_PROFILES_IMAGES = Array.from({ length: MAX_PROFILES_COUNT }, (_, i) => `profile${i + 1}.png`);