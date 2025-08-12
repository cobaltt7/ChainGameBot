import { model, Schema } from "mongoose";

export const ChatConfig = model(
	"ChatConfig",
	new Schema({
		guild: { type: String, required: true },
		channel: String,
		enabled: { type: Boolean, default: false },
	}),
);

export const Chat = model(
	"Chat",
	new Schema({
		guild: { type: String, required: true },
		prompt: String,
		response: { type: String, required: true },
	}),
);
export const ChatConsent = model(
	"ChatConsent",
	new Schema({
		user: { type: String, required: true },
		default: { type: Boolean, default: false },
		guilds: { type: Map, of: Boolean, default: {} },
	}),
);
