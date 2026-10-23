import type { Env } from './types/env';
import type { Fields } from './types/firestore';
import { getAccessToken } from './utils/access-token';
import { sendPush } from './utils/fcm';
import { getDoc, listEvents, removeTokens, str, strList } from './utils/firestore';

// India Standard Time is UTC+5:30
const IST_OFFSET_MS = 330 * 60 * 1000;

// The day this run reminds about (today or tomorrow in IST),
// as UTC midnight, the same form the app stores event dates in
function getReminderDay(when: 'today' | 'tomorrow'): Date {
	const nowInIst = new Date(Date.now() + IST_OFFSET_MS);
	const extraDays = when === 'tomorrow' ? 1 : 0;

	return new Date(Date.UTC(nowInIst.getUTCFullYear(), nowInIst.getUTCMonth(), nowInIst.getUTCDate() + extraDays));
}

// The date the event was saved with; for a yearly event, its first year.
// Stored as UTC midnight, read back as that UTC day
function readFirstDate(fields: Fields): Date | null {
	const raw = fields.date?.timestampValue as string | undefined;
	if (!raw) return null;

	const stored = new Date(raw);

	return new Date(Date.UTC(stored.getUTCFullYear(), stored.getUTCMonth(), stored.getUTCDate()));
}

// Same rule as KeepsakeEvent.isOn in the app.
// One-off: only its first date. Yearly: same month and day, from the first year on
function fallsOn(firstDate: Date, yearly: boolean, reminderDay: Date): boolean {
	if (!yearly) return firstDate.getTime() === reminderDay.getTime();

	return (
		reminderDay >= firstDate &&
		reminderDay.getUTCMonth() === firstDate.getUTCMonth() &&
		reminderDay.getUTCDate() === firstDate.getUTCDate()
	);
}

// Pushes a reminder to both partners for each event that falls on the reminder day
export async function sendReminders(env: Env, when: 'today' | 'tomorrow'): Promise<void> {
	const reminderDay = getReminderDay(when);
	const access = await getAccessToken(env);
	const events = await listEvents(access);

	for (const { name, fields } of events) {
		const firstDate = readFirstDate(fields);
		const yearly = fields.yearly?.booleanValue === true;

		if (!firstDate || !fallsOn(firstDate, yearly, reminderDay)) continue;

		// name is projects/.../documents/couples/{coupleId}/events/{eventId}
		const parts = name.split('/');
		const eventId = parts[parts.length - 1];
		const coupleId = parts[parts.length - 3];

		// One failing couple shouldn't stop the others
		try {
			await remindCouple(coupleId, eventId, fields, firstDate, yearly, reminderDay, when, access);
		} catch (e) {
			console.error(`Reminder for ${name} failed`, e);
		}
	}
}

async function remindCouple(
	coupleId: string,
	eventId: string,
	fields: Fields,
	firstDate: Date,
	yearly: boolean,
	reminderDay: Date,
	when: 'today' | 'tomorrow',
	access: string,
): Promise<void> {
	const couple = await getDoc(`couples/${coupleId}`, access);
	const members = couple ? strList(couple, 'members') : [];

	// On the day, yearly events show which year it is, e.g. "Our anniversary · 3 years"
	const title = str(fields, 'title') || 'A special day';
	const years = reminderDay.getUTCFullYear() - firstDate.getUTCFullYear();
	const body = when === 'today' && yearly && years > 0 ? `${title} · ${years === 1 ? '1 year' : `${years} years`}` : title;

	// FCM data values must all be strings
	const data = {
		type: 'reminder',
		eventId,
		title: when === 'today' ? 'Today' : 'Tomorrow',
		body,
	};

	await Promise.all(
		members.map(async (uid) => {
			const user = await getDoc(`users/${uid}`, access);
			if (!user) return;

			// The user's Push setting, on unless turned off
			if (user.pushEnabled?.booleanValue === false) return;

			const tokens = strList(user, 'fcmTokens');
			const results = await Promise.all(tokens.map((t) => sendPush(t, data, access)));

			const dead = tokens.filter((_, i) => !results[i]);
			if (dead.length > 0) await removeTokens(uid, dead, access);
		}),
	);
}
