import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import {
	buildTemplateResponse,
	detectMessageKind,
	getCallbackMessage,
	getEventId,
	sendVkMessage,
	type VkCallbackBody,
} from "../vk";

const AnyVKEventSchema = z.object({
	type: z.string(),
	group_id: z.number().optional(),
	event_id: z.string().optional(),
	v: z.string().optional(),
	secret: z.string().optional(),
	object: z.record(z.any()).optional(),
}).passthrough();

const ConfirmationExample = {
	group_id: 123456789,
	event_id: "0000000000000000000000000000000000000000",
	v: "5.199",
	type: "confirmation",
	secret: "vk_callback_secret_from_cloudflare",
};

const MessageTextExample = {
	type: "message_new",
	group_id: 123456789,
	event_id: "1111111111111111111111111111111111111111",
	v: "5.199",
	secret: "vk_callback_secret_from_cloudflare",
	object: {
		message: {
			id: 1001,
			from_id: 456,
			peer_id: 456,
			text: "Привет",
		},
	},
};

function normalizeCopiedJson(rawBody: string): string {
	return rawBody
		.replace(/^\uFEFF/, "")
		.replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, " ");
}

function parseVkCallbackBody(rawBody: string): VkCallbackBody {
	try {
		return JSON.parse(rawBody) as VkCallbackBody;
	} catch (initialError) {
		const normalizedBody = normalizeCopiedJson(rawBody);
		if (normalizedBody === rawBody) {
			throw initialError;
		}

		try {
			return JSON.parse(normalizedBody) as VkCallbackBody;
		} catch {
			throw initialError;
		}
	}
}

export class VkWebhookRoute extends OpenAPIRoute {
	schema = {
		method: "post",
		path: "/vk",
		summary: "VK Callback API webhook",
		description: "Receives VK Callback API events, stores the original raw JSON body in D1, validates VK secret, and returns the expected VK callback response.",
		tags: ["VK"],
		requestBody: {
			required: true,
			description: "Paste a VK Callback API JSON payload here. The confirmation example intentionally uses placeholder group_id and secret values.",
			content: {
				"application/json": {
					schema: {
						type: "object",
						required: ["type"],
						additionalProperties: true,
						properties: {
							type: { type: "string", example: "confirmation" },
							group_id: { type: "integer", example: 123456789 },
							event_id: { type: "string", example: "0000000000000000000000000000000000000000" },
							v: { type: "string", example: "5.199" },
							secret: { type: "string", example: "vk_callback_secret_from_cloudflare" },
							object: { type: "object", additionalProperties: true },
						},
					},
					examples: {
						confirmation: {
							summary: "Confirmation event",
							value: ConfirmationExample,
						},
						messageText: {
							summary: "message_new with text",
							value: MessageTextExample,
						},
					},
				},
			},
		},
		responses: {
			200: {
				description: "VK callback response. confirmation returns VK_CONFIRMATION_CODE; other valid callbacks return ok.",
				content: { "text/plain": { schema: z.string() } },
			},
			400: {
				description: "Invalid JSON body",
				content: { "text/plain": { schema: z.string() } },
			},
			403: {
				description: "Wrong VK secret token",
				content: { "text/plain": { schema: z.string() } },
			},
		},
	};

	async handle(c: AppContext) {
		let rawBody = "";
		let body: VkCallbackBody;

		try {
			rawBody = await c.req.text();
			body = parseVkCallbackBody(rawBody);
		} catch (err) {
			await this.saveError(c, rawBody || "invalid-json", err);
			return c.text("invalid json", 400);
		}

		const type = typeof body.type === "string" ? body.type : "unknown";
		const message = getCallbackMessage(body);
		const messageKind = detectMessageKind(message);
		const responseText = buildTemplateResponse(messageKind, message);
		const eventId = getEventId(body, message);
		const secretMatch = Boolean(c.env.VK_SECRET_TOKEN && body.secret === c.env.VK_SECRET_TOKEN);
		const requiresSecret = Boolean(c.env.VK_SECRET_TOKEN);

		const insertResult = await c.env.DB.prepare(`
			INSERT INTO vk_webhooks (
				type,
				group_id,
				event_id,
				user_id,
				peer_id,
				message_id,
				message_kind,
				raw_body,
				response_text,
				secret_match,
				processed,
				error
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			type,
			body.group_id ?? null,
			eventId,
			message?.from_id ?? null,
			message?.peer_id ?? null,
			message?.id ?? null,
			messageKind,
			rawBody,
			responseText,
			secretMatch,
			false,
			requiresSecret && !secretMatch ? "VK secret mismatch" : null,
		).run();

		const recordId = insertResult.meta.last_row_id;

		if (requiresSecret && !secretMatch) {
			return c.text("forbidden", 403);
		}

		if (type === "confirmation") {
			const confirmationCode = c.env.VK_CONFIRMATION_CODE;
			if (!confirmationCode) {
				await this.markProcessed(c, recordId, false, "VK_CONFIRMATION_CODE is not configured");
				return c.text("confirmation code is not configured", 500);
			}

			await this.markProcessed(c, recordId, true, null);
			return c.text(confirmationCode);
		}

		if (type === "message_new" && responseText && message?.peer_id) {
			if (!c.env.VK_GROUP_ACCESS_TOKEN) {
				await this.markProcessed(c, recordId, false, "VK_GROUP_ACCESS_TOKEN is not configured");
				return c.text("ok");
			}

			try {
				await sendVkMessage({
					accessToken: c.env.VK_GROUP_ACCESS_TOKEN,
					apiVersion: c.env.VK_API_VERSION,
					peerId: message.peer_id,
					message: responseText,
				});
				await this.markProcessed(c, recordId, true, null);
			} catch (err) {
				await this.markProcessed(c, recordId, false, err);
			}
		} else {
			await this.markProcessed(c, recordId, true, null);
		}

		return c.text("ok");
	}

	private async saveError(c: AppContext, rawBody: string, err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		await c.env.DB.prepare(`
			INSERT INTO vk_webhooks (type, raw_body, processed, error)
			VALUES ('error', ?, false, ?)
		`).bind(rawBody, message.slice(0, 1000)).run();
	}

	private async markProcessed(c: AppContext, id: number | undefined, processed: boolean, err: unknown) {
		if (!id) {
			return;
		}

		const message = err ? (err instanceof Error ? err.message : String(err)).slice(0, 1000) : null;
		await c.env.DB.prepare(`
			UPDATE vk_webhooks
			SET processed = ?, error = ?
			WHERE id = ?
		`).bind(processed, message, id).run();
	}
}
