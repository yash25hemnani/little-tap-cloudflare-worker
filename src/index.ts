import type { Env } from './types/env';
import type { NotifyBody } from './types/notify';
import { getAccessToken } from './utils/access-token';
import { verifyCaller } from './utils/auth';
import { sendPush } from './utils/fcm';
import { getDoc, removeTokens, steps, str, strList } from './utils/firestore';
import { isId } from './utils/validate';

// Sends a push to the partner after a tap is saved.
// The app calls POST / with { coupleId, momentId } and its Firebase ID token.
export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') return new Response(null, { status: 405 });

		// Who is calling
		const uid = await verifyCaller(request);
		if (!uid) return new Response('Unauthorized', { status: 401 });

		// Get the body -> coupleId and momentId
		const body = (await request.json().catch(() => null)) as NotifyBody | null;

		const coupleId = body?.coupleId;
		const momentId = body?.momentId;

		if (!isId(coupleId) || !isId(momentId)) {
			return new Response('Bad request', { status: 400 });
		}

		try {
			const access = await getAccessToken(env);

			// The moment must exist and be sent by the caller
			const moment = await getDoc(`couples/${coupleId}/moments/${momentId}`, access);

			if (!moment) return new Response('Not found', { status: 404 });

			if (str(moment, 'fromUid') !== uid) return new Response('Forbidden', { status: 403 });

			// The caller must be in the couple
			const couple = await getDoc(`couples/${coupleId}`, access);

			const members = couple ? strList(couple, 'members') : [];

			if (!members.includes(uid)) return new Response('Forbidden', { status: 403 });

			// Get the partnerUid
			const partnerUid = members.find((m) => m !== uid);
			if (!partnerUid) return new Response(null, { status: 204 });

			// Get the partner and self docs
			const [partner, me] = await Promise.all([getDoc(`users/${partnerUid}`, access), getDoc(`users/${uid}`, access)]);

			// Get partner's FCM token
			const tokens = partner ? strList(partner, 'fcmTokens') : [];
			if (tokens.length === 0) return new Response(null, { status: 204 });

			// Build the message; FCM data values must all be strings
			const name = (me && str(me, 'name')) || 'Your partner';
			// The partner's Vibration setting, on unless turned off
			const vibrate = partner?.vibrationEnabled?.booleanValue !== false;

			const data = {
				coupleId,
				momentId,
				// The feeling leads, e.g. "Missing you" / "A little tap from Yash"
				title: str(moment, 'title') || 'A little tap',
				body: `A little tap from ${name}`,
				// Feeling colour as an ARGB int, used to tint the notification
				color: moment.color?.integerValue ?? '',
				// Empty means don't buzz
				vibration: vibrate ? JSON.stringify(steps(moment, 'vibration')) : '',
			};

			const results = await Promise.all(tokens.map((t) => sendPush(t, data, access)));

			// Cleanup runs after the response is sent
			const dead = tokens.filter((_, i) => !results[i]);
			if (dead.length > 0) ctx.waitUntil(removeTokens(partnerUid, dead, access));

			return new Response(null, { status: 204 });
		} catch (e) {
			console.error(e);
			return new Response('Server error', { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
