export type AppBindings = {
	DB: D1Database;
	/** Token for protected service endpoints. Store it as a Cloudflare secret. */
	API_AUTH_TOKEN: string;
	/** VK Callback API confirmation string. Store it as a Cloudflare secret. */
	VK_CONFIRMATION_CODE: string;
	/** VK Callback API secret. Store it as a Cloudflare secret and set the same value in VK. */
	VK_SECRET_TOKEN: string;
	/** VK community access token for messages.send. Store it as a Cloudflare secret. */
	VK_GROUP_ACCESS_TOKEN?: string;
	/** Optional VK API version override. */
	VK_API_VERSION?: string;
};
