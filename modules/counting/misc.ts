import { inlineCode } from "discord.js";
import { model, Schema } from "mongoose";

export const Counting = model(
	"Counting",
	new Schema({
		base: { type: Number, default: 10 },
		channel: { type: String, required: true },
		enabled: { type: Boolean, default: true },
		logs: String,
		reset: { type: Boolean, default: false },
		silent: { type: Boolean, default: false },
		step: { type: Number, default: 1 },

		lastAuthor: String,
		lastId: String,
		lastNumber: { type: Number, default: 0 },
	}),
);
export function stringifyNumber(number: number, base: number): string {
	return base === 10 ? number.toLocaleString() : inlineCode(number.toString(base).toUpperCase());
}

export function parseNumber(number: string, base: number): number {
	if (base === 10) {
		if (/^[+-]?\d{1,3}(?:\d*|(?:,\d{3})*)$/i.test(number))
			return Number.parseInt(number.replaceAll(",", ""), base);
		return Number.NaN;
	}

	const validCharacters = "0123456789abcdefghijklmnopqrstuvwxyz".slice(0, base);
	if (new RegExp(`^[+-]?[${validCharacters}]+$`, "i").test(number))
		return Number.parseInt(number, base);
	return Number.NaN;
}
