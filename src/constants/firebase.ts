export const PROJECT = 'a-little-tap';

// Full name of the database, used for document names in writes
export const DATABASE = `projects/${PROJECT}/databases/(default)`;

export const FIRESTORE_URL = `https://firestore.googleapis.com/v1/${DATABASE}/documents`;
export const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`;

// Firebase ID tokens: who signs them and where the public keys live
export const ID_TOKEN_ISSUER = `https://securetoken.google.com/${PROJECT}`;
export const ID_TOKEN_KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
