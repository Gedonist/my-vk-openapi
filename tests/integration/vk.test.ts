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
