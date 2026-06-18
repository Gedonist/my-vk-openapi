type UnknownRecord = Record<string, unknown>;

export type VkCallbackBody = UnknownRecord & {
	type?: string;
	group_id?: number;
	secret?: string;
	event_id?: string;
	object?: UnknownRecord;
};

export type VkMessage = UnknownRecord & {
	id?: number;
	from_id?: number;
	peer_id?: number;
	text?: string;
	attachments?: Array<UnknownRecord & { type?: string }>;
};

export type VkMessageKind =
	| "text"
	| "photo"
	| "voice"
	| "file"
	| "video"
	| "audio"
	| "sticker"
	| "link"
	| "message"
	| "unknown";

function asRecord(value: unknown): UnknownRecord | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

export function getCallbackObject(body: VkCallbackBody): UnknownRecord | null {
	return asRecord(body.object);
}

export function getCallbackMessage(body: VkCallbackBody): VkMessage | null {
	const object = getCallbackObject(body);
	if (!object) {
		return null;
	}

	const nestedMessage = asRecord(object.message);
	if (nestedMessage) {
		return nestedMessage as VkMessage;
	}

	if ("text" in object || "attachments" in object || "peer_id" in object) {
		return object as VkMessage;
	}

	return null;
}

export function detectMessageKind(message: VkMessage | null): VkMessageKind | null {
	if (!message) {
		return null;
	}

	if (typeof message.text === "string" && message.text.trim().length > 0) {
		return "text";
	}

	const attachments = Array.isArray(message.attachments) ? message.attachments : [];
	const attachmentTypes = new Set(attachments.map((attachment) => attachment.type).filter(Boolean));

	if (attachmentTypes.has("photo")) return "photo";
	if (attachmentTypes.has("audio_message")) return "voice";
	if (attachmentTypes.has("doc")) return "file";
	if (attachmentTypes.has("video")) return "video";
	if (attachmentTypes.has("audio")) return "audio";
	if (attachmentTypes.has("sticker")) return "sticker";
	if (attachmentTypes.has("link")) return "link";
	if (attachments.length > 0) return "message";

	return "unknown";
}

export function buildTemplateResponse(kind: VkMessageKind | null, message: VkMessage | null): string | null {
	switch (kind) {
		case "text": {
			const text = typeof message?.text === "string" ? message.text.trim() : "";
			const suffix = text ? `: ${text.slice(0, 500)}` : "";
			return `Вижу пришел текст${suffix}`;
		}
		case "photo":
			return "Вижу пришла картинка";
		case "voice":
			return "Вижу пришло голосовое";
		case "file":
			return "Вижу пришел файл";
		case "video":
			return "Вижу пришло видео";
		case "audio":
			return "Вижу пришло аудио";
		case "sticker":
			return "Вижу пришел стикер";
		case "link":
			return "Вижу пришла ссылка";
		case "message":
			return "Вижу пришло сообщение";
		case "unknown":
			return "Вижу пришел неизвестный тип сообщения";
		default:
			return null;
	}
}

export function getEventId(body: VkCallbackBody, message: VkMessage | null): string | null {
	if (typeof body.event_id === "string") return body.event_id;
	if (typeof body.object?.event_id === "string") return body.object.event_id;
	if (typeof message?.id === "number") return String(message.id);
	return null;
}

export async function sendVkMessage(params: {
	accessToken: string;
	apiVersion?: string;
	peerId: number;
	message: string;
}): Promise<void> {
	const body = new URLSearchParams({
		access_token: params.accessToken,
		v: params.apiVersion || "5.199",
		peer_id: String(params.peerId),
		random_id: String(Date.now()),
		message: params.message,
	});

	const response = await fetch("https://api.vk.com/method/messages.send", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body,
	});

	const payload = await response.json<{ error?: { error_msg?: string } }>();
	if (!response.ok || payload.error) {
		throw new Error(payload.error?.error_msg || `VK API request failed with status ${response.status}`);
	}
}
