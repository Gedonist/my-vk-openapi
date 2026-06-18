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
	secret: z.string().optional(),
	object: z.record(z.any()).optional(),
}).passthrough();

export class VkWebhookRoute extends OpenAPIRoute {
	static schema = {
		method: "post",
		path: "/vk",
		summary: "VK Callback API webhook",
		tags: ["VK"],
		request: {
			body: {
				content: {
					"application/json": {
						schema: AnyVKEventSchema,
					},
				},
			},
		},
		responses: {
			200: {
				description: "VK callback response",
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
			body = JSON.parse(rawBody) as VkCallbackBody;
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
