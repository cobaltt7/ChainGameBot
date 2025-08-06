import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	ComponentInContainerData,
	User,
} from "discord.js";

import {
	ButtonStyle,
	channelLink,
	ComponentType,
	hideLinkEmbed,
	hyperlink,
	MessageFlags,
	SeparatorSpacingSize,
} from "discord.js";
import { client } from "strife.js";

import constants from "../../common/constants.ts";
import { ChatConsent } from "./misc.ts";

async function getSettings(user: User): Promise<string> {
	const consent = await ChatConsent.findOne({ user: user.id }).exec();
	const overrides =
		consent?.guilds.size
		&& Array.from(consent.guilds.entries(), async ([id, status]) => {
			const server = await client.guilds.fetch(id).catch(() => void 0);
			return `${hyperlink(
				server?.name ?? `Unknown server ${id}`,
				hideLinkEmbed(channelLink("", id)),
			)}: ${constants.emojis.statuses[status ? "yes" : "no"]}`;
		});
	return `**Enabled globally**: ${constants.emojis.statuses[consent?.default ? "yes" : "no"]}\n${
		overrides ? (await Promise.all(overrides)).join("\n") : "No server overrides"
	}`;
}
function createButtons(inGuild: boolean): ComponentInContainerData[] {
	return [
		{
			type: ComponentType.ActionRow,
			components: [
				{
					customId: "allow_chatConsent",
					type: ComponentType.Button,
					label: `Store my messages in ${inGuild ? "this server" : "all servers"}`,
					style: ButtonStyle.Success,
				},
				{
					customId: "deny_chatConsent",
					type: ComponentType.Button,
					label: `Don’t store my messages in ${inGuild ? "this server" : "all servers"}`,
					style: ButtonStyle.Danger,
				},
			],
		},
		{
			type: ComponentType.TextDisplay,
			content:
				inGuild ?
					"-# To change your settings globally, run this command in DMs."
				:	"**Changing your settings here will change your default preference in all servers!** You are still able to override the choice below on a per-server basis by running this command in each server.",
		},
	];
}
export async function showConsent(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.reply({
		flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,

		components: [
			{
				type: ComponentType.Container,
				accentColor: constants.themeColor,
				components: [
					{
						type: ComponentType.TextDisplay,
						content: "## CGB Chat\n### Basic regurgitating chatbot",
					},
					{
						type: ComponentType.TextDisplay,
						content:
							"CGB Chat learns by tracking messages across all channels. Any stored messages may be regurgitated, but only in the server you sent it in. Messages will never be sent cross-server.\n"
							+ "Your messages will only be stored if you give explicit permission using the button below. You will be able to change your preference at any time, however any past messages can’t be deleted, as message authors are not stored. By default, your messages are not saved.",
					},
					{
						type: ComponentType.Separator,
						divider: false,
						spacing: SeparatorSpacingSize.Small,
					},
					...createButtons(interaction.inGuild()),
					{
						type: ComponentType.Separator,
						divider: false,
						spacing: SeparatorSpacingSize.Small,
					},
					{ type: ComponentType.TextDisplay, content: "## Current Settings" },
					{
						type: ComponentType.TextDisplay,
						content: await getSettings(interaction.user),
					},
				],
			},
		],
	});
}
export async function chatConsent(interaction: ButtonInteraction, type: string): Promise<void> {
	const consent = await ChatConsent.findOneAndUpdate(
		{ user: interaction.user.id },
		{},
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	).exec();

	if (interaction.inGuild()) consent.guilds.set(interaction.guildId, type === "allow");
	else consent.default = type === "allow";

	await consent.save();

	await interaction.reply({
		flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,

		components: [
			{
				type: ComponentType.TextDisplay,
				content: `${constants.emojis.statuses.yes} Updated settings!`,
			},
			{ type: ComponentType.TextDisplay, content: "## Current Settings" },
			{ type: ComponentType.TextDisplay, content: await getSettings(interaction.user) },
			{ type: ComponentType.Separator, divider: false, spacing: SeparatorSpacingSize.Small },
			...createButtons(interaction.inGuild()),
		],
	});
}
