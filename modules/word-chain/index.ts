import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import { defineButton, defineChatCommand, defineEvent, defineModal } from "strife.js";

import configWordChain, {
	autocompleteLanguage,
	promptLastLetter,
	resetChannel,
	resetChannelConfirm,
	resetChannelModal,
	setLastLetter,
} from "./config.ts";
import handleWordChain, { handleDelete, handleEdit } from "./handle.ts";

defineChatCommand(
	{
		name: "word-chain",
		description: "View or edit word chain settings for a channel",
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
				],
				required: true,
			},
			enabled: {
				description: "Enable word chain in that channel (defaults to true)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			logs: {
				description:
					"The channel to warn in when people count incorrectly (defaults to the word chain channel)",
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
			silent: {
				description:
					"Act silently, not deleting invalid messages and only reacting to numbers (defaults to false)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
			language: {
				description: "[BETA] The language to check valid words in (defaults to English)",
				type: ApplicationCommandOptionType.String,
				required: false,
				autocomplete: autocompleteLanguage,
			},
			phrases: {
				description: "[BETA] Allow using multi-word phrases (defaults to false)",
				type: ApplicationCommandOptionType.Boolean,
				required: false,
			},
		},
	} as const,
	configWordChain,
);

defineEvent("messageCreate", handleWordChain);

defineButton("setLastLetter", promptLastLetter);
defineModal("setLastLetter", setLastLetter);

defineButton("resetChannel", resetChannelConfirm);
defineButton("resetChannelConfirmed", resetChannelModal);
defineModal("resetChannel", resetChannel);

defineEvent("messageUpdate", handleEdit);
defineEvent("messageDelete", handleDelete);
