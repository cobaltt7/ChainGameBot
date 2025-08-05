import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	GuildTextBasedChannel,
	ModalSubmitInteraction,
	Snowflake,
} from "discord.js";

import assert from "node:assert";

import {
	ButtonStyle,
	channelMention,
	ComponentType,
	hyperlink,
	inlineCode,
	MessageFlags,
	messageLink,
	TextInputStyle,
	userMention,
} from "discord.js";

import constants from "../../common/constants.ts";
import { displayLogChannel } from "../../common/misc.ts";
import { assertSendable, tryReact } from "../../util/discord.ts";
import { Counting, parseNumber, stringifyNumber } from "./misc.ts";

export default async function configCounting(
	interaction: ChatInputCommandInteraction<"cached" | "raw">,
	newConfig: {
		base?: number;
		channel: GuildTextBasedChannel;
		enabled?: boolean;
		logs?: GuildTextBasedChannel;
		reset?: boolean;
		silent?: boolean;
		step?: number;
	},
): Promise<void> {
	assert(interaction.guild);

	const config = await Counting.findOneAndUpdate(
		{ channel: newConfig.channel.id },
		{ ...newConfig, channel: newConfig.channel.id, logs: newConfig.logs?.id },
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	).exec();

	const lastLink =
		config.lastId && messageLink(config.channel, config.lastId, interaction.guild.id);
	await interaction.reply({
		embeds: [
			{
				title: "Counting Settings",
				color: constants.themeColor,
				description:
					`**Channel**: ${channelMention(config.channel)}\n`
					+ `**Enabled**: ${constants.emojis.statuses[config.enabled ? "yes" : "no"]}\n\n`
					+ `**Logs Channel**: ${await displayLogChannel(config, interaction.guild)}\n`
					+ `**Base**: ${config.base.toLocaleString()}\n`
					+ `**Step**: ${config.step.toLocaleString()}\n`
					+ `**Reset on Invalid**: ${
						constants.emojis.statuses[config.reset ? "yes" : "no"]
					}\n\n`
					+ `*Last Number: ${
						(lastLink ?
							hyperlink(stringifyNumber(config.lastNumber, config.base), lastLink)
						:	stringifyNumber(config.lastNumber, config.base))
						+ (config.lastAuthor ? ` by ${userMention(config.lastAuthor)}` : "")
					}*`,
			},
		],
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						customId: `${config.channel},${interaction.user.id}_setLastNumber`,
						label: "Set Last Number",
						style: ButtonStyle.Secondary,
					},
				],
			},
		],
	});
}

export async function promptLastNumber(
	interaction: ButtonInteraction,
	data: Snowflake,
): Promise<void> {
	const [channelId, userId] = data.split(",");
	if (interaction.user.id !== userId) return;
	await interaction.showModal({
		title: "Set Last Number",
		customId: `${channelId}_setLastNumber`,
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.TextInput,
						customId: "number",
						label: "Last Number",
						style: TextInputStyle.Short,
						required: true,
					},
				],
			},
		],
	});
}

export async function setLastNumber(
	interaction: ModalSubmitInteraction,
	channelId: string,
): Promise<void> {
	const config = await Counting.findOne({ channel: channelId }).exec();
	if (!config) {
		await interaction.reply({
			 flags: MessageFlags.Ephemeral,
			content: `${
				constants.emojis.statuses.no
			} Could not find a Counting configuration for ${channelMention(channelId)}!`,
		});
		return;
	}

	const rawNumber = interaction.fields.getTextInputValue("number");
	const number = parseNumber(rawNumber, config.base);
	if (Number.isNaN(number)) {
		await interaction.reply({
			 flags: MessageFlags.Ephemeral,
			content: `${constants.emojis.statuses.no} **Invalid number!** ${inlineCode(
				// eslint-disable-next-line unicorn/string-content
				rawNumber.replaceAll("`", "'"),
			)} could not be parsed as a number. (base: ${config.base.toLocaleString()})`,
		});
		return;
	}

	const channel = await interaction.guild?.channels
		.fetch(channelId)
		.then((channel) => channel && assertSendable(channel));
	const message = channel && (await channel.send(number.toString(config.base).toUpperCase()));
	if (message) await tryReact(message, "👍");

	await config
		.updateOne({
			lastNumber: number,
			lastAuthor: interaction.user.id,
			lastId: (message ?? interaction).id,
		})
		.exec();

	await interaction.reply(
		`${constants.emojis.statuses.yes} Set the last number in ${channelMention(
			channelId,
		)} to ${stringifyNumber(number, config.base)}!`,
	);
}
