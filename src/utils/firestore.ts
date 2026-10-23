import { DATABASE, FIRESTORE_URL } from '../constants/firebase';
import type { Fields } from '../types/firestore';

// Reads one document's fields, or null if it doesn't exist
export async function getDoc(path: string, access: string): Promise<Fields | null> {
	const res = await fetch(`${FIRESTORE_URL}/${path}`, {
		headers: { Authorization: `Bearer ${access}` },
	});

	if (res.status === 404) return null;

	if (!res.ok) throw new Error(`Read ${path} failed: ${await res.text()}`);

	const doc = (await res.json()) as { fields?: Fields };

	return doc.fields ?? {};
}

export const str = (f: Fields, key: string): string => f[key]?.stringValue ?? '';

// An empty array comes back without `values`
export const strList = (f: Fields, key: string): string[] => f[key]?.arrayValue?.values?.map((v: any) => v.stringValue as string) ?? [];

// Moment's vibration as plain [{ms, amp}] steps; integers come back as strings
export const steps = (f: Fields, key: string): { ms: number; amp: number }[] =>
	f[key]?.arrayValue?.values?.map((v: any) => ({
		ms: Number(v.mapValue?.fields?.ms?.integerValue ?? 0),
		amp: Number(v.mapValue?.fields?.amp?.integerValue ?? 0),
	})) ?? [];

// Same as FieldValue.arrayRemove on users/{uid}.fcmTokens
export async function removeTokens(uid: string, tokens: string[], access: string): Promise<void> {
	const res = await fetch(`${FIRESTORE_URL}:commit`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${access}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			writes: [
				{
					transform: {
						document: `${DATABASE}/documents/users/${uid}`,
						fieldTransforms: [
							{
								fieldPath: 'fcmTokens',
								removeAllFromArray: { values: tokens.map((t) => ({ stringValue: t })) },
							},
						],
					},
				},
			],
		}),
	});
	if (!res.ok) console.error(`Token cleanup failed: ${await res.text()}`);
}

// Every couples/*/events doc with its full path; a collection group query
export async function listEvents(access: string): Promise<{ name: string; fields: Fields }[]> {
	const res = await fetch(`${FIRESTORE_URL}:runQuery`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${access}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			structuredQuery: { from: [{ collectionId: 'events', allDescendants: true }] },
		}),
	});

	if (!res.ok) throw new Error(`List events failed: ${await res.text()}`);

	// One item per result; an empty result is a single item without `document`
	const rows = (await res.json()) as { document?: { name: string; fields?: Fields } }[];

	return rows.flatMap((r) => (r.document ? [{ name: r.document.name, fields: r.document.fields ?? {} }] : []));
}
