import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import { defineChatCommand, defineEvent } from "strife.js";

import configOuijaBoard from "./config.ts";
import { handleDelete, handleEdit, handleOujia, initOuija } from "./handle.ts";

defineChatCommand(
	{
		name: "ouija-board",
		description: "View or edit ouija board settings for a channel",
		access: false,
		restricted: true,
		options: {
			channel: {
				description: "The channel to view or edit settings for",
				type: ApplicationCommandOptionType.Channel,
				channelTypes: [ChannelType.GuildForum, ChannelType.GuildMedia],
				required: true,
			},
			enabled: {
				description: "Mark that channel as a ouija board (defaults to true)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			react: {
				description: "React to valid characters with 👍 (defaults to true)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			complete: {
				description:
					"What members should send when the full response has been sent (defaults to “goodbye”)",
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		},
	} as const,
	configOuijaBoard,
);

defineEvent("threadCreate", initOuija);
defineEvent("messageCreate", handleOujia);
defineEvent("messageUpdate", handleEdit);
defineEvent("messageDelete", handleDelete);
