import type { AnyThreadChannel, Message, PartialMessage } from "discord.js";

import { userMention } from "discord.js";
import { client, escapeAllMarkdown } from "strife.js";

import constants from "../../common/constants.ts";
import { tryReact } from "../../util/discord.ts";
import { Ouija, OuijaBoardConfig } from "./misc.ts";
import processWord, { resendDeleted } from "./process.ts";

export async function initOuija(thread: AnyThreadChannel, newlyCreated: boolean): Promise<void> {
	if (!newlyCreated || !thread.parent) return;

	const config = await OuijaBoardConfig.findOne({ channel: thread.parent.id }).exec();
	if (!config?.enabled) return;

	await new Ouija({ channel: thread.id, owner: thread.ownerId }).save();
}

export async function handleOujia(message: Message): Promise<void> {
	if (message.system || !message.channel.isThread() || !message.channel.parent) return;

	const ouija = await Ouija.findOne({ channel: message.channel.id }).exec();
	if (!ouija) return;

	if (message.id === message.channel.id) {
		if (message.channel.sendable) await message.channel.send("The spirits are responding…");
		return;
	}

	if (message.author.id === client.user.id) return;

	if (ouija.lastUser === message.author.id || ouija.owner === message.author.id) {
		if (message.deletable) await message.delete().catch(() => void 0);
		return;
	}

	const config = await OuijaBoardConfig.findOne({ channel: message.channel.parent.id }).exec();

	const character = processWord(message.cleanContent, config?.complete);

	const last = ouija.answer.at(-1);
	if (
		character === false
		|| ((character === " " || character === true) && (!last || last.endsWith(" ")))
	) {
		if (message.deletable) await message.delete().catch(() => void 0);
		return;
	}

	if (config?.react) await tryReact(message, "👍");

	if (character === true) {
		await ouija.deleteOne();
		if (message.channel.sendable)
			await message.channel.send(
				`## ${userMention(ouija.owner)} wants to know: __${escapeAllMarkdown(
					message.channel.name,
				)}__\n`
					+ "**The spirits have responded!**\n"
					+ `> ${[ouija.answer].flat().join("")}`,
			);
		return;
	}

	if (typeof ouija.answer === "string") ouija.answer += character;
	else ouija.answer.push(character);
	ouija.markModified("answer");

	ouija.lastUser = message.author.id;
	ouija.lastMessage = message.id;

	await ouija.save();
}

export async function handleEdit(_: Message | PartialMessage, message: Message): Promise<void> {
	const ouija = await Ouija.findOne({
		channel: message.channel.id,
		lastMessage: message.id,
	}).exec();
	if (!ouija || typeof ouija.answer === "string") return;

	const last = ouija.answer.at(-1);
	if (!last || processWord(message.cleanContent) === last) return;

	await resendDeleted(ouija, message.channel);

	const deleted = message.deletable && (await message.delete().catch(() => void 0));
	if (!deleted) await tryReact(message, constants.emojis.statuses.no);
}
export async function handleDelete(message: Message | PartialMessage): Promise<void> {
	const ouija = await Ouija.findOne({
		channel: message.channel.id,
		lastMessage: message.id,
	}).exec();
	if (!ouija || typeof ouija.answer === "string") return;

	await resendDeleted(ouija, message.channel);
}
