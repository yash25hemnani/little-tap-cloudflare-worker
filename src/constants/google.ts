export const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Firestore read/write and sending FCM messages
export const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging';

// Renew the access token this long before it expires
export const TOKEN_REFRESH_MARGIN_MS = 60_000;
