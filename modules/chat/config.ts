import type { ChatInputCommandInteraction, GuildTextBasedChannel } from "discord.js";

import assert from "node:assert";

import { channelMention } from "discord.js";

import constants from "../../common/constants.ts";
import { ChatConfig, deprecationMessage } from "./misc.ts";

export default async function configChat(
	interaction: ChatInputCommandInteraction<"cached" | "raw">,
	newConfig: { channel?: GuildTextBasedChannel; enabled: boolean },
): Promise<void> {
	assert(interaction.guild);

	const config = await ChatConfig.findOneAndUpdate(
		{ guild: interaction.guild.id },
		{ enabled: newConfig.enabled, channel: newConfig.channel?.id ?? null },
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	).exec();

	await interaction.reply({
		content:
			(config.enabled ?
				config.channel ?
					`${constants.emojis.statuses.yes} CGB Chat is currently enabled, tracking all public channels, and responding in ${channelMention(config.channel)}.`
				:	`${constants.emojis.statuses.no} CGB Chat is currently enabled and tracking all public channels, but no chat channel is configured.`
			:	`${constants.emojis.statuses.no} CGB Chat is currently disabled in this server.`)
			+ deprecationMessage,
	});
}
