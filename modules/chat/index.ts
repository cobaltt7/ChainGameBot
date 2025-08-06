import type { Message, Snowflake } from "discord.js";

import { setTimeout as wait } from "node:timers/promises";

import { ApplicationCommandOptionType, ApplicationCommandType, ChannelType } from "discord.js";
import {
	defineButton,
	defineChatCommand,
	defineEvent,
	defineMenuCommand,
	zeroWidthSpace,
} from "strife.js";

import { assertSendable } from "../../util/discord.ts";
import sendChat, { learn, removeResponse } from "./chat.ts";
import configChat from "./config.ts";
import { chatConsent, showConsent } from "./consent.ts";

defineChatCommand(
	{
		name: "cgb-chat",
		description: `View or edit the server’s CGB Chat settings`,
		access: false,
		restricted: true,
		options: {
			channel: {
				description: `The channel to use for CGB Chat, or omit to only track messages and not respond`,
				type: ApplicationCommandOptionType.Channel,
				channelTypes: [
					ChannelType.AnnouncementThread,
					ChannelType.GuildAnnouncement,
					ChannelType.GuildStageVoice,
					ChannelType.GuildText,
					ChannelType.GuildVoice,
					ChannelType.PrivateThread,
					ChannelType.PublicThread,
				],
				required: false,
			},
			enabled: {
				description: `Enable tracking messages in this server`,
				type: ApplicationCommandOptionType.Boolean,
				required: true,
			},
		},
	} as const,
	configChat,
);
defineChatCommand(
	{ name: "allow-cgb-chat", description: "Allow CGB to save your messages for use in CGB Chat" },
	showConsent,
);
defineButton("chatConsent", chatConsent);

const ignoredChannels = new Set<Snowflake>();
const sentResponses = new Map<Snowflake, Message>();
defineEvent("messageCreate", async (message) => {
	if (!message.inGuild()) return;
	await learn(message);

	if (!assertSendable(message.channel)) return;
	const response = await sendChat(message);
	if (!response) return;

	if (ignoredChannels.has(message.channel.id)) return;
	ignoredChannels.add(message.channel.id);
	await message.channel.sendTyping();
	await wait(Math.random() * Math.random() * 4750);
	ignoredChannels.delete(message.channel.id);

	if (message.system) sentResponses.set(message.id, await message.channel.send(response));
	else sentResponses.set(message.id, await message.reply(response));
});

defineEvent("messageUpdate", async (_, message) => {
	if (!message.inGuild()) return;

	const found = sentResponses.get(message.id);
	if (!found && +"0" < 1 /* TODO: only return if there's new messages */) return;

	const response = await sendChat(message);
	if (found?.editable)
		await found.edit(
			response ?? { content: zeroWidthSpace, components: [], embeds: [], files: [] },
		);
	if (!found && response) {
		if (!assertSendable(message.channel)) return;
		if (message.system) sentResponses.set(message.id, await message.channel.send(response));
		else sentResponses.set(message.id, await message.reply(response));
	}
});

defineEvent("messageDelete", async (message) => {
	const found = sentResponses.get(message.id);
	if (found?.deletable) await found.delete();

	const reference =
		found?.id ?? [...sentResponses.entries()].find(([, { id }]) => id === message.id)?.[0];
	if (reference) sentResponses.delete(reference);
});

defineMenuCommand(
	{
		name: `Remove CGB Chat Response`,
		type: ApplicationCommandType.Message,
		restricted: true,
		access: false,
	},
	removeResponse,
);
