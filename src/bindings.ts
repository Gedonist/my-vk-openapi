export type AppBindings = {
	DB: D1Database;
	/** VK Callback API confirmation string. Store it as a Cloudflare secret. */
	VK_CONFIRMATION_CODE: string;
	/** Shared secret for VK Callback API callbacks and protected service endpoints. Store it as a Cloudflare secret and set the same value in VK. */
	VK_SECRET_TOKEN: string;
	/** VK community access token for messages.send. Store it as a Cloudflare secret. */
	VK_GROUP_ACCESS_TOKEN?: string;
	/** Optional VK API version override. */
	VK_API_VERSION?: string;
};
