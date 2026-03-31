import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import { defineButton, defineChatCommand, defineEvent, defineModal } from "strife.js";

import configCounting, { promptLastNumber, setLastNumber } from "./config.ts";
import handleCounting, { handleDelete, handleEdit } from "./handle.ts";

defineChatCommand(
	{
		name: "counting",
		description: "View or edit counting settings for a channel",
		access: false,
		restricted: true,
		options: {
			channel: {
				description: "The channel to view or edit settings for",
				type: ApplicationCommandOptionType.Channel,
				channelTypes: [
					ChannelType.AnnouncementThread,
					ChannelType.GuildAnnouncement,
					ChannelType.GuildStageVoice,
					ChannelType.GuildText,
					ChannelType.GuildVoice,
					ChannelType.PrivateThread,
					ChannelType.PublicThread,
				] as const,
				required: true,
			},
			enabled: {
				description: "Enable counting in that channel (defaults to true)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			logs: {
				description:
					"The channel to warn in when people count incorrectly (defaults to the counting channel)",
				type: ApplicationCommandOptionType.Channel,
				channelTypes: [
					ChannelType.AnnouncementThread,
					ChannelType.GuildAnnouncement,
					ChannelType.GuildStageVoice,
					ChannelType.GuildText,
					ChannelType.GuildVoice,
					ChannelType.PrivateThread,
					ChannelType.PublicThread,
				] as const,
				required: false,
			},
			silent: {
				description:
					"Act silently, not deleting invalid messages and only reacting to numbers (defaults to false)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			reset: {
				description:
					"Reset to 0 on incorrect numbers instead of continuing from the previous number (defaults to false)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			step: {
				description: "The step between each number (defaults to 1)",
				type: ApplicationCommandOptionType.Integer,
				required: false,
			},
			base: {
				description: "The base to count in (defaults to 10)",
				type: ApplicationCommandOptionType.Integer,
				maxValue: 36,
				minValue: 2,
			},
		},
	} as const,
	configCounting,
);

defineEvent("messageCreate", handleCounting);

defineButton("setLastNumber", promptLastNumber);
defineModal("setLastNumber", setLastNumber);

defineEvent("messageUpdate", handleEdit);
defineEvent("messageDelete", handleDelete);
