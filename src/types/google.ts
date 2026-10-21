// The fields used from the service account JSON
export interface ServiceAccount {
	client_email: string;
	private_key: string;
}

// Response from Google's token endpoint
export interface AccessTokenResponse {
	access_token: string;
	expires_in: number; // seconds
}
