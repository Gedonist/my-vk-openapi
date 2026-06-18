import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppBindings } from "./bindings";
import { VkLogsRoute } from "./endpoints/vkLogs";
import { VkWebhookRoute } from "./endpoints/vkEndpoint";

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
			version: "1.0.0",
			description: "Cloudflare Worker for receiving VK Callback API events, saving them to D1, and sending template replies.",
		},
	},
});

openapi.post("/vk", VkWebhookRoute);
openapi.get("/vk/logs", VkLogsRoute);

export default app;
