import type { TextBasedChannel } from "discord.js";
import type { Ouija } from "./misc.ts";

import { userMention } from "discord.js";
import { stripMarkdown } from "strife.js";

import { tryReact } from "../../util/discord.ts";
import { normalize } from "../../util/text.ts";

const BLANKS = new Set(["blank", "space", "tab", "enter"]);

export default function processWord(content: string, complete?: string): string | boolean {
	const character = stripMarkdown(content);
	const normalized = normalize(character);
	if (normalized === complete) return true;
	if (BLANKS.has(normalized) || /^\s+$/.test(character)) return " ";
	if ([...new Intl.Segmenter().segment(character)].length === 1) return content;
	return false;
}

export async function resendDeleted(
	ouija: InstanceType<typeof Ouija>,
	channel: TextBasedChannel,
): Promise<void> {
	if (!channel.isThread() || !channel.sendable) return;

	const last = ouija.answer.at(-1);
	if (!last) return;

	const message = await channel.send(
		ouija.lastUser ? `*${last} - ${userMention(ouija.lastUser)}*` : `*${last}*`,
	);
	await tryReact(message, "👍");

	ouija.lastMessage = message.id;
	await ouija.save();
}
