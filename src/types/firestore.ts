// Firestore REST wraps every value with its type, e.g. { name: { stringValue: "Yash" } }
export type Fields = Record<string, any>;
