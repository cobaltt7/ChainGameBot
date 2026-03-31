import type { Message, PartialMessage, TextBasedChannel } from "discord.js";

import { channelMention, hyperlink, inlineCode, userMention } from "discord.js";
import { client } from "strife.js";

import constants from "../../common/constants.ts";
import { getLogChannel } from "../../common/misc.ts";
import { assertSendable, tryReact } from "../../util/discord.ts";
import { Counting, parseNumber, stringifyNumber } from "./misc.ts";

export default async function handleCounting(message: Message): Promise<void> {
	const config = await Counting.findOne({ channel: message.channel.id }).exec();
	if (!config || !message.inGuild() || client.user.id === message.author.id || !config.enabled)
		return;

	const logs = await getLogChannel(config, message.guild);
	if (logs === false) {
		const owner = assertSendable(message.channel) ?? (await message.guild.fetchOwner());
		try {
			await owner.send(
				`${constants.emojis.statuses.no} **Configuration error: Unknown logs channel!** I either could not find or do not have permissions to send messages in ${channelMention(
					config.logs ?? config.channel,
				)}. It may have been deleted or its permissions may have been updated. Please update your Counting configuration for the ${hyperlink(
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

	const current = parseNumber(message.content, config.base);
	if (Number.isNaN(current)) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Invalid number!** ${inlineCode(
				// eslint-disable-next-line unicorn/string-content
				message.content.replaceAll("`", "'"),
			)} could not be parsed as a number. (base: ${config.base.toLocaleString()})`,
		);
		return;
	}

	if (config.lastAuthor === message.author.id) {
		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **You can’t count twice in a row!**`,
		);
		return;
	}

	const next = config.lastNumber + config.step;
	if (next !== current) {
		if (config.reset)
			await config.updateOne({ lastNumber: 0, lastAuthor: null, lastId: message.id }).exec();

		if (!logs) await tryReact(message, "👎");

		await reject(
			`${
				constants.emojis.statuses.no
			} ${message.author.toString()} **Wrong number!** ${stringifyNumber(
				next,
				config.base,
			)} comes after ${stringifyNumber(
				config.lastNumber,
				config.base,
			)}, not ${stringifyNumber(current, config.base)}.${
				config.reset ? " **Reset to 0.**" : ""
			} (base: ${config.base.toLocaleString()}; step: ${config.step.toLocaleString()})`,
		);
		return;
	}

	await config
		.updateOne({ lastNumber: next, lastAuthor: message.author.id, lastId: message.id })
		.exec();
	await tryReact(message, "👍");
}

export async function handleEdit(_: Message | PartialMessage, message: Message): Promise<void> {
	const config = await Counting.findOne({
		channel: message.channel.id,
		lastId: message.id,
	}).exec();
	if (!config) return;

	if (parseNumber(message.content, config.base) === config.lastNumber) return;

	await resendDeleted(config, message.channel);

	const deleted = message.deletable && (await message.delete().catch(() => void 0));
	if (!deleted) await tryReact(message, constants.emojis.statuses.no);
}
export async function handleDelete(message: Message | PartialMessage): Promise<void> {
	const config = await Counting.findOne({
		channel: message.channel.id,
		lastMessage: message.id,
	}).exec();
	if (!config) return;

	await resendDeleted(config, message.channel);
}

async function resendDeleted(
	config: InstanceType<typeof Counting>,
	channel: TextBasedChannel,
): Promise<void> {
	if (!channel.isSendable()) return;

	const message = await channel.send(
		config.lastAuthor ?
			`*${config.lastNumber.toLocaleString()} - ${userMention(config.lastAuthor)}*`
		:	`*${config.lastNumber.toLocaleString()}*`,
	);
	await tryReact(message, "👍");

	config.lastId = message.id;
	await config.save();
}
