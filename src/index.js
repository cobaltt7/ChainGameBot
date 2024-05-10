/** @file Main Logic. */

import { fileURLToPath } from "url";

import { GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";



import login, { client } from "strife.js";

process.on("unhandledException", console.error);
process.on("unhandledRejection", console.error);

// Set up process.env
dotenv.config();


await login({
	modulesDirectory: fileURLToPath(new URL("./modules", import.meta.url)),


	clientOptions: {
		intents:
			GatewayIntentBits.Guilds |
			GatewayIntentBits.GuildMembers |
			GatewayIntentBits.GuildModeration |
			GatewayIntentBits.GuildEmojisAndStickers |
			GatewayIntentBits.GuildWebhooks |
			GatewayIntentBits.GuildInvites |
			GatewayIntentBits.GuildVoiceStates |
			GatewayIntentBits.GuildPresences |
			GatewayIntentBits.GuildMessages |
			GatewayIntentBits.GuildMessageReactions |
			GatewayIntentBits.DirectMessages |
			GatewayIntentBits.MessageContent |
			GatewayIntentBits.GuildScheduledEvents |
			GatewayIntentBits.AutoModerationExecution,
		presence: { status: "dnd" },
	},
	commandErrorMessage: `An error occurred.`,
})

client.user.setStatus("online");
