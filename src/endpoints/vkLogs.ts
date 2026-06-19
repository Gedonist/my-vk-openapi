import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { isAuthorized } from "../auth";

export class VkLogsRoute extends OpenAPIRoute {
	schema = {
		method: "get",
		path: "/vk/logs",
		summary: "List stored VK callbacks",
		description: "Protected endpoint. Use the same VK_SECRET_TOKEN that VK sends in callback bodies. Swagger Authorize supports BearerAuth or ApiTokenHeader; query token is kept only for manual curl tests.",
		tags: ["VK"],
		security: [{ BearerAuth: [] }, { ApiTokenHeader: [] }],
		request: {
			query: z.object({
				limit: z.string().optional().default("50"),
				type: z.string().optional(),
				message_kind: z.string().optional(),
				token: z.string().optional(),
			}),
		},
		responses: {
			200: {
				description: "Stored callbacks",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							data: z.array(z.any()),
						}),
					},
				},
			},
			401: {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: z.object({ success: z.boolean(), error: z.string() }),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		if (!isAuthorized(c)) {
			return c.json({ success: false, error: "Unauthorized" }, 401);
		}

		const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50", 10) || 50, 1), 200);
		const typeFilter = c.req.query("type");
		const messageKindFilter = c.req.query("message_kind");

		const where: string[] = [];
		const params: Array<string | number> = [];

		if (typeFilter) {
			where.push("type = ?");
			params.push(typeFilter);
		}

		if (messageKindFilter) {
			where.push("message_kind = ?");
			params.push(messageKindFilter);
		}

		params.push(limit);

		const query = `
			SELECT *
			FROM vk_webhooks
			${where.length ? `WHERE ${where.join(" AND ")}` : ""}
			ORDER BY received_at DESC
			LIMIT ?
		`;

		const { results } = await c.env.DB.prepare(query).bind(...params).all();

		return c.json({ success: true, data: results });
	}
}
