import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppBindings } from "./bindings";
import { VkLogsRoute } from "./endpoints/vkLogs";
import { VkWebhookRoute } from "./endpoints/vkEndpoint";
import { API_VERSION } from "./version";

const app = new Hono<{ Bindings: AppBindings }>();

app.onError((err, c) => {
	if (err instanceof ApiException) {
		return c.json(
			{ success: false, errors: err.buildResponse() },
			err.status as ContentfulStatusCode,
		);
	}

	console.error("Unhandled error:", err);
	return c.json(
		{
			success: false,
			errors: [{ code: 7000, message: "Internal Server Error" }],
		},
		500,
	);
});

const openapi = fromHono(app, {
	docs_url: "/",
	schema: {
		info: {
			title: "VK Callback API Worker",
			version: API_VERSION,
			description: "Cloudflare Worker for receiving VK Callback API events, saving them to D1, and sending template replies.",
		},
	},
});

openapi.registry.registerComponent("securitySchemes", "BearerAuth", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "API_AUTH_TOKEN",
	description: "Paste API_AUTH_TOKEN here to authorize protected service endpoints.",
});

openapi.registry.registerComponent("securitySchemes", "ApiTokenHeader", {
	type: "apiKey",
	in: "header",
	name: "x-api-token",
	description: "Alternative API_AUTH_TOKEN header.",
});

openapi.post("/vk", VkWebhookRoute);
openapi.get("/vk/logs", VkLogsRoute);

export default app;
