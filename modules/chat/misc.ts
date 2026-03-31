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

export const deprecationMessage =
	"\n\n**CGB Chat will be removed soon.**"
	+ " Due to low usage, high memory use, and privacy and performance concerns, CGB Chat will be removed in the coming months."
	+ " If you still actively use CGB Chat, please reach out in the support server (linked in my bio).";
