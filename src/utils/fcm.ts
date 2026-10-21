import { FCM_URL } from '../constants/firebase';

// Sends to one phone; returns false only when the token is dead
export async function sendPush(token: string, title: string, body: string, data: Record<string, string>, access: string): Promise<boolean> {
	const res = await fetch(FCM_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${access}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			message: {
				token,
				notification: { title, body },
				data,
				// Delivered promptly even when the phone is idle
				android: { priority: 'HIGH' },
			},
		}),
	});
	if (res.ok) return true;

	// 404 means the app was uninstalled or the token replaced
	if (res.status === 404) return false;

	// Other errors may be temporary, so the token is kept
	console.error(`Push failed: ${await res.text()}`);
	return true;
}
