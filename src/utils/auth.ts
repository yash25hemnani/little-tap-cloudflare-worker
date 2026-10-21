import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ID_TOKEN_ISSUER, ID_TOKEN_KEYS_URL, PROJECT } from '../constants/firebase';

// Google's public keys for Firebase ID tokens, fetched and cached by jose
const firebaseKeys = createRemoteJWKSet(new URL(ID_TOKEN_KEYS_URL));

// Checks the Firebase ID token and returns the user's uid, or null
export async function verifyCaller(request: Request): Promise<string | null> {
	const auth = request.headers.get('Authorization') ?? '';
	if (!auth.startsWith('Bearer ')) return null;

	try {
		const { payload } = await jwtVerify(auth.slice(7), firebaseKeys, {
			issuer: ID_TOKEN_ISSUER,
			audience: PROJECT,
		});
		return payload.sub ?? null;
	} catch {
		return null;
	}
}
