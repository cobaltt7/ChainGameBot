import type { Snowflake } from "discord.js";

import { model, Schema } from "mongoose";

export const OuijaBoardConfig = model(
	"OuijaBoardConfig",
	new Schema({
		channel: { type: String, required: true },
		enabled: { type: Boolean, default: true },
		react: { type: Boolean, default: true },
		complete: { type: String, default: "goodbye" },
	}),
);

export const Ouija = model(
	"Ouija",
	new Schema<{
		channel: string;
		answer: string | string[];
		owner: Snowflake;
		lastUser?: Snowflake;
		lastMessage?: Snowflake;
	}>({
		channel: { type: String, required: true },
		answer: { type: Schema.Types.Mixed, default: [] },
		owner: { type: String, required: true },
		lastUser: String,
		lastMessage: String,
	}),
);
