import type { Message } from "discord.js";

import { channelMention, hyperlink, inlineCode, messageLink, userMention } from "discord.js";
import { client, stripMarkdown } from "strife.js";

import constants from "../../common/constants.ts";
import { getLogChannel } from "../../common/misc.ts";
import { assertSendable, tryReact } from "../../util/discord.ts";
import { normalize, truncateText } from "../../util/text.ts";
import { isWord, languages, Word, WordChainConfig } from "./misc.ts";

export default async function handleWordChain(message: Message): Promise<void> {
	const config = await WordChainConfig.findOne({ channel: message.channel.id }).exec();
	if (!config || !message.inGuild() || client.user.id === message.author.id || !config.enabled)
		return;

	const owner = assertSendable(message.channel) ?? (await message.guild.fetchOwner());
	const logs = await getLogChannel(config, message.guild);
	if (logs === false) {
		try {
			await owner.send(
				`${constants.emojis.statuses.no} **Configuration error: Unknown logs channel!** I either could not find or do not have permissions to send messages in ${channelMention(
					config.logs ?? config.channel,
				)}. It may have been deleted or its permissions may have been updated. Please update your Word Chain configuration for the ${hyperlink(
					message.guild.name,
					message.channel.url,
				)} server.`,
			);
		} catch {}

		await tryReact(message, constants.emojis.statuses.no);

		await config.updateOne({ enabled: false }).exec();
		return;
	}

	const language = languages[config.language];
	if (!language) {
		if (logs)
			await logs.send(
				`${constants.emojis.statuses.no} ${userMention(
					message.guild.ownerId,
				)} **Configuration error: Unknown language in config!** ${inlineCode(
					config.language,
				)} could not be resolved to a language and is no longer supported. Please update your config.`,
			);
		else
			try {
				await owner.send(
					`${constants.emojis.statuses.no} **Configuration error: Unknown language in config!** ${inlineCode(
						config.language,
					)} could not be resolved to a language and is no longer supported. Please update your Word Chain configuration for the ${hyperlink(
						message.guild.name,
						message.channel.url,
					)} server.`,
				);
			} catch {}
		await tryReact(message, constants.emojis.statuses.no);

		await config.updateOne({ enabled: false }).exec();
		return;
	}

	async function reject(reason: string): Promise<void> {
		if (logs === undefined) return;
		if (message.deletable) await message.delete().catch(() => void 0);

		if (!logs) return;
		await logs.send({ content: reason, allowedMentions: { users: [message.author.id] } });
	}

	const word = stripMarkdown(message.cleanContent.normalize("NFC"));
	if (!config.phrases && /[\d\s#&+./:;<=>?@[\\\]_`{|}~\ud800\ufffd]/.test(word)) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Invalid word!** ${inlineCode(
				// eslint-disable-next-line unicorn/string-content
				truncateText(message.content.replaceAll("`", "'"), 255),
			)} contains invalid characters.`,
		);
		return;
	}

	if (word.length < 3) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Too short!** ${inlineCode(
				word.toLowerCase(),
			)} must be 3 or more characters long.`,
		);
		return;
	}

	const current = normalize(word);
	if (!(await isWord(current, language))) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Unknown word!** ${inlineCode(
				current,
			)} is not a word. (language: ${language.name})`,
		);
		return;
	}

	const duplicate = await Word.findOne({ channel: message.channel.id, word: current }).exec();
	if (duplicate) {
		if (!logs) await tryReact(message, "👎");
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Duplicate word!** ${inlineCode(
				current,
			)} has [been used before](<${messageLink(
				message.channel.id,
				duplicate.id,
				message.guild.id,
			)}>) by ${userMention(duplicate.author)}.`,
		);
		return;
	}

	const latest = await Word.findOne({ channel: message.channel.id })
		.sort({ createdAt: -1 })
		.exec();

	if (latest?.author === message.author.id) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **You can’t send two words in a row!**`,
		);
		return;
	}

	const letter = latest && latest.word.at(-1);
	if (letter && letter !== current[0]) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Wrong letter!** ${inlineCode(
				current,
			)} does not start with ${inlineCode(letter.toUpperCase())}, which ${inlineCode(
				latest.word,
			)} ends with.`,
		);
		return;
	}

	await new Word({
		channel: message.channel.id,
		author: message.author.id,
		id: message.id,
		word: current,
	}).save();
	await tryReact(message, "👍");
}
