import type {
	ActionRowData,
	ButtonInteraction,
	ChatInputCommandInteraction,
	InteractionButtonComponentData,
	User,
} from "discord.js";

import {
	ButtonStyle,
	channelLink,
	ComponentType,
	hideLinkEmbed,
	hyperlink,
	MessageFlags,
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
	return `## Current Settings\n**Enabled globally**: ${
		constants.emojis.statuses[consent?.default ? "yes" : "no"]
	}\n${overrides ? (await Promise.all(overrides)).join("\n") : "No server overrides"}`;
}
function createButtons(inGuild: boolean): ActionRowData<InteractionButtonComponentData>[] {
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
	];
}
export async function showConsent(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.reply({
		content:
			`## CGB Chat\n`
			+ `### Basic regurgitating chatbot\n`
			+ `CGB Chat learns by tracking messages across all channels. Any stored messages may be regurgitated, but only in the server you sent it in. Messages will never be sent cross-server.\n`
			+ `Your messages will only be stored if you give explicit permission using the button below. You will be able to change your preference at any time, however any past messages can’t be deleted, as message authors are not stored. By default, your messages are not saved.\n`
			+ `${await getSettings(interaction.user)}${
				interaction.inGuild() ? "" : (
					"\n\n**Changing your settings here will change your default preference in all servers!** You are still able to override the choice below on a per-server basis."
				)
			}`,
		components: createButtons(interaction.inGuild()),
		flags: MessageFlags.Ephemeral,
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
		flags: MessageFlags.Ephemeral,
		content: `${
			constants.emojis.statuses.yes
		} Updated settings!\n${await getSettings(interaction.user)}`,
		components: createButtons(interaction.inGuild()),
	});
}
