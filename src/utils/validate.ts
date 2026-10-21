// IDs go into Firestore paths, so only plain ID characters are allowed
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
