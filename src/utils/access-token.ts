import { importPKCS8, SignJWT } from 'jose';
import { SCOPES, TOKEN_REFRESH_MARGIN_MS, TOKEN_URL } from '../constants/google';
import type { Env } from '../types/env';
import type { AccessTokenResponse, ServiceAccount } from '../types/google';

// Reused across requests until shortly before it expires
let cachedToken = '';
let cachedUntil = 0;

// Google access token for Firestore and FCM
export async function getAccessToken(env: Env): Promise<string> {
	if (Date.now() < cachedUntil) return cachedToken;

	const sa = JSON.parse(env.SERVICE_ACCOUNT) as ServiceAccount;
	const key = await importPKCS8(sa.private_key, 'RS256');

	// Signed claim: "I am this service account and want these scopes for 1 hour"
	const jwt = await new SignJWT({ scope: SCOPES })
		.setProtectedHeader({ alg: 'RS256' })
		.setIssuer(sa.client_email)
		.setAudience(TOKEN_URL)
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(key);

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	});
	if (!res.ok) throw new Error(`Token request failed: ${await res.text()}`);

	const { access_token, expires_in } = (await res.json()) as AccessTokenResponse;
	cachedToken = access_token;
	cachedUntil = Date.now() + expires_in * 1000 - TOKEN_REFRESH_MARGIN_MS;
	return cachedToken;
}
