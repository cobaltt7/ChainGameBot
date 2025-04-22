import type { Message } from "discord.js";

import { channelMention, hyperlink, inlineCode, PermissionFlagsBits } from "discord.js";
import { client } from "strife.js";

import constants from "../../common/constants.ts";
import { getLogChannel } from "../../common/misc.ts";
import { assertSendable } from "../../util/discord.ts";
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

		if (message.channel.permissionsFor(client.user)?.has(PermissionFlagsBits.AddReactions))
			await message.react(constants.emojis.statuses.no);

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
		if (
			!logs
			&& message.channel.permissionsFor(client.user)?.has(PermissionFlagsBits.AddReactions)
		)
			await message.react("👎");
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
	if (message.channel.permissionsFor(client.user)?.has(PermissionFlagsBits.AddReactions))
		await message.react("👍");
}
