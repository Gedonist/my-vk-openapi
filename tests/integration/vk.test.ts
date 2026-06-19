import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const authHeaders = {
	Authorization: "Bearer test-api-token",
};

describe("VK callback API", () => {
	it("returns the configured confirmation code and stores the callback", async () => {
		const response = await SELF.fetch("http://local.test/vk", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "confirmation",
				group_id: 1,
				secret: "test-vk-secret",
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("test-confirmation-code");
	});

	it("accepts confirmation JSON copied with non-breaking spaces in the raw body", async () => {
		const rawBody = `{
  "group_id": 1,
  "event_id": "dbc09585a0d30bc681b09c2849100fcd7ac1f389",
  "v": "5.199",
  "type": "confirmation",
  "secret": "test-vk-secret"
}`;

		const response = await SELF.fetch("http://local.test/vk", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: rawBody,
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("test-confirmation-code");
	});

	it("exposes API version, authorization schemes, and body examples in OpenAPI", async () => {
		const response = await SELF.fetch("http://local.test/openapi.json");
		expect(response.status).toBe(200);

		const schema = await response.json<Record<string, any>>();
		expect(schema.info.version).toBe("1.1.0");
		expect(schema.components.securitySchemes.BearerAuth).toEqual(expect.objectContaining({ type: "http", scheme: "bearer" }));
		expect(schema.paths["/vk"].post.requestBody.content["application/json"].examples.confirmation.value).toEqual(
			expect.objectContaining({
				type: "confirmation",
				group_id: 123456789,
				secret: "vk_callback_secret_from_cloudflare",
			}),
		);
	});

	it("stores text messages and prepares a template reply", async () => {
		const response = await SELF.fetch("http://local.test/vk", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "message_new",
				group_id: 1,
				secret: "test-vk-secret",
				object: {
					message: {
						id: 101,
						from_id: 202,
						peer_id: 202,
						text: "Привет",
					},
				},
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");

		const logsResponse = await SELF.fetch("http://local.test/vk/logs?type=message_new", {
			headers: authHeaders,
		});
		const logs = await logsResponse.json<{ data: Array<Record<string, unknown>> }>();

		expect(logsResponse.status).toBe(200);
		expect(logs.data[0]).toEqual(
			expect.objectContaining({
				type: "message_new",
				message_kind: "text",
				response_text: "Вижу пришел текст: Привет",
				secret_match: 1,
			}),
		);
	});

	it("rejects callbacks with a wrong VK secret after saving the raw payload", async () => {
		const response = await SELF.fetch("http://local.test/vk", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				type: "message_new",
				group_id: 1,
				secret: "wrong",
				object: { message: { id: 102, peer_id: 202, text: "test" } },
			}),
		});

		expect(response.status).toBe(403);

		const logsResponse = await SELF.fetch("http://local.test/vk/logs?limit=1", {
			headers: authHeaders,
		});
		const logs = await logsResponse.json<{ data: Array<Record<string, unknown>> }>();

		expect(logs.data[0]).toEqual(expect.objectContaining({ secret_match: 0 }));
	});

	it("protects logs with API_AUTH_TOKEN", async () => {
		const response = await SELF.fetch("http://local.test/vk/logs");

		expect(response.status).toBe(401);
	});
});
