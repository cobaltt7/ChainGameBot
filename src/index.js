import dotenv from "dotenv";
import fetch from "axios";
import fileSystem from "fs";
import mongoose from "mongoose";
import { Client, Intents as intents, MessageEmbed, TextChannel } from "discord.js";

// set up process.env
dotenv.config();

const CHANNELS = { rules: "823941821695918121" };
const ME_ID = "771422735486156811";

//set up db stuffs

await mongoose.connect(`${process.env.MONGO_URL}?retryWrites=true&w=majority`, {
	appName: "bot",
});
mongoose.connection.on("error", console.error);

const databases = {};

const games = await Promise.all(
	fileSystem.readdirSync(new URL("./games", import.meta.url)).map(async (file) => {
		return (await import("./games/" + file)).default;
	}),
);

const guildSchema = {
	id: {
		type: String,
		unique: true,
		required: true,
	},
};
games.forEach((game) => {
	databases[`${game.name}`] = mongoose.model(
		game.name,
		new mongoose.Schema({
			word: {
				type: String,
				required: true,
				unique: true,
				lowercase: true,
				trim: true,
			},
			author: {
				type: String,
				required: true,
			},
			id: {
				type: String,
				unique: true,
				required: true,
			},
			index: {
				type: Number,
				required: true,
				unique: true,
			},
		}),
	);
	guildSchema[`${game.name}`] = {
		type: String,
	};
});
databases.Guilds = mongoose.model("Guild", new mongoose.Schema(guildSchema));

const Discord = new Client({
	intents: [
		intents.FLAGS.GUILDS,
		intents.FLAGS.GUILD_MESSAGES,
		intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		intents.FLAGS.DIRECT_MESSAGES,
		intents.FLAGS.DIRECT_MESSAGE_TYPING,
	],
});
Discord.once("ready", () => console.log(`Connected to Discord with id`, Discord.application?.id))
	.on("disconnect", () => console.warn("Disconnected from Discord"))
	.on("debug", console.debug)
	.on("warn", console.warn)
	.on("error", console.error)
	.on("typingStart", async (msg) => {
		await msg.channel.send({ content: "No DMs, sorry!" });
	})
	.on("messageCreate", async (msg) => {
		if (!msg.guild) {
			await msg.reply({ content: "No DMs, sorry!" });
			return;
		}
		const guildInfo = await databases.Guilds.findOne({ id: msg.guild?.id || "" }).exec();
		if (!guildInfo) return;
		const game = games.find((game) => guildInfo[game.name] === msg.channelId);
		const logChannelId = guildInfo["logs_" + game?.name] || guildInfo.logs;
		if (!game || !logChannelId) return;
		/** @type {TextChannel | undefined} */
		// @ts-expect-error -- It's impossible for this to be set as a non-text channel.
		const ruleChannel = await Discord.channels.fetch(logChannelId);
		if (!ruleChannel) return;
		try {
			const word = msg.content.toLowerCase().trim().replaceAll("`", "'");

			if (!game.whitespace && /\s/.test(word)) {
				// don't allow whitespace
				msg.delete();

				const embed = new MessageEmbed()
					.setTitle("Multiple words sent!")
					.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
					.setDescription(`\`${word}\` is more than one word!`);

				ruleChannel.send({
					content: msg.author.toString(),
					embeds: [embed],
				});
				return;
			}

			if (game.validWordsOnly) {
				// use Wiktionary's API to determine if it is a word
				/** @type {any} */
				const response = await fetch({
					headers: {
						"User-Agent":
							"Word Chain Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Word Chain game // https://github.com/RedGuy12/ShitoriBot",
					},
					method: "GET",
					url: `https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&page=${word}`, // todo not wikitionary
				});
				if (response.data.error) {
					msg.delete();

					const embed = new MessageEmbed()
						.setTitle("Not a word!")
						.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
						.setDescription(`\`${word}\` is not a word!`);

					ruleChannel.send({
						content: msg.author.toString(),
						embeds: [embed],
					});
					return;
				}
			}

			const lastWord = await databases[game.name].findOne().sort({ index: -1 }).exec();

			if (game.manualCheck) {
				const manualCheckResult = game.manualCheck(word, lastWord);
				if (manualCheckResult !== true) {
					msg.delete();
					ruleChannel.send({
						content: msg.author.toString(),
						embeds: [
							manualCheckResult.setAuthor(
								msg.author.tag,
								msg.author.displayAvatarURL(),
							),
						],
					});
					return;
				}
			}

			if (!game.twiceInRow && lastWord?.author === msg.author.id) {
				msg.delete();

				const embed = new MessageEmbed()
					.setTitle("Posting twice in a row!")
					.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
					.setDescription(`No posting twice in a row allowed!`);

				ruleChannel.send({
					content: msg.author.toString(),
					embeds: [embed],
				});
				return;
			}

			if (!game.duplicates) {
				// determine if it has been used before
				const used = await databases[game.name].findOne({ word }).exec();
				if (used) {
					msg.delete();
					const usedMsg = await msg.channel.messages.fetch(used.id);
					const embed = new MessageEmbed()
						.setTitle("Duplicate word!")
						.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
						.setDescription(
							`\`${word}\` has [been used before](https://discord.com/channels/${usedMsg.guildId}/${usedMsg.channelId}/${used.id}) by <@${used.author}>!`,
						)
						.setThumbnail((await Discord.users.fetch(used.author)).displayAvatarURL());

					ruleChannel.send({
						content: msg.author.toString(),
						embeds: [embed],
					});
					return;
				}
			}

			// all checks out, add to db
			await new databases[game.name]({
				word,
				author: msg.author.id,
				id: msg.id,
				index: (lastWord?.index ?? -1) + 1,
			}).save();

			await msg.react("👍");
			return;
		} catch (error) {
			handleError(error, ruleChannel.send, ruleChannel);
		}
	})
	.on("interactionCreate", async (interaction) => {
		try {
			if (!interaction.isCommand()) return;

			if (interaction.commandName === "ping") {
				return await interaction.reply({ content: "Pong!", ephemeral: true });
			}
			if (interaction.commandName === "invite") {
				return await interaction.reply({
					content:
						"https://discord.com/api/oauth2/authorize?client_id=823932474118635540&permissions=2147838016&scope=bot%20applications.commands",
					ephemeral: true,
				});
			}
			if (interaction.commandName === "set-game") {
				if (!interaction.guild)
					return await interaction.reply({ content: "No DMs, sorry!", ephemeral: true });
				if (!interaction.member?.permissionsIn?.(interaction.channel).has("MANAGE_GUILD"))
					return await interaction.reply({
						content: "Lacking permissions, sorry!",
						ephemeral: true,
					});
				const game = interaction.options.getString("game");
				if (!game)
					return interaction.reply({
						content: "Please specify a game!",
						ephemeral: true,
					});
				if (await databases.Guilds.findOne({ id: interaction.guild.id }))
					await databases.Guilds.updateOne(
						{ id: interaction.guild.id },
						{ [game]: interaction.channel?.id },
					);
				else
					await new databases.Guilds({
						id: interaction.guild.id,
						[game]: interaction.channel?.id,
					}).save();
				await interaction.reply({
					content: "This channel has been initialized for a game of " + game + "!",
				});
				// purge channel option
			}
			if (interaction.commandName === "set-logs") {
				if (!interaction.guild)
					return await interaction.reply({ content: "No DMs, sorry!", ephemeral: true });
				if (!interaction.member?.permissionsIn?.(interaction.channel).has("MANAGE_GUILD"))
					return await interaction.reply({
						content: "Lacking permissions, sorry!",
						ephemeral: true,
					});
				const game = interaction.options.getString("game");
				if (game) {
					if (await databases.Guilds.findOne({ id: interaction.guild.id }))
						await databases.Guilds.updateOne(
							{ id: interaction.guild.id },
							{ ["logs_" + game]: interaction.channel?.id },
						);
					else
						await new databases.Guilds({
							id: interaction.guild.id,
							[game]: interaction.channel?.id,
						}).save();
					await interaction.reply({
						content: "Logs for " + game + " will be posted here!",
					});
				} else {
					if (await databases.Guilds.findOne({ id: interaction.guild.id }))
						await databases.Guilds.updateOne(
							{ id: interaction.guild.id },
							{ logs: interaction.channel?.id },
						);
					else
						await new databases.Guilds({
							id: interaction.guild.id,
							logs: interaction.channel?.id,
						}).save();
					await interaction.reply({
						content: "Logs will be posted here if no game-specific channel is set!",
					});
				}
				// purge channel option
			}
		} catch (error) {
			await handleError(error, interaction.reply || (() => {}), interaction.channel);
		}
	});

Discord.login(process.env.BOT_TOKEN);

async function handleError(error, send, ruleChannel) {
	try {
		console.error(error);

		const pingMe = await ruleChannel.guild.members.fetch(ME_ID);
		const embed = new MessageEmbed()
			.setTitle("Error!")
			.setDescription(
				`Uhoh! I found an error!\n\`\`\`json\n${JSON.stringify(error).replaceAll(
					"```",
					"[3 backticks]",
				)}\`\`\``,
			);
		if (pingMe) {
			send({
				content: "<@" + ME_ID + ">",
				embeds: [embed],
			});
		} else {
			const message = await send({
				embeds: [embed],
			});
			(await Discord.users.fetch(ME_ID)).send({
				content: message.url,
				embeds: [embed],
			});
		}
		return;
	} catch (errorError) {
		console.error(errorError);
	}
}
