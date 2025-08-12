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
	new Schema({
		channel: { type: String, required: true },
		answer: { type: String, default: "" },
		owner: { type: String, required: true },
		lastUser: String,
	}),
);
