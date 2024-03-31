/** @file Main Logic. */
import fileSystem from "fs";
import url from "url";

import { Client, Intents as intents, MessageEmbed } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";

import isWord from "./isWord.js";

process.on("unhandledException", console.error);
process.on("unhandledRejection", console.error);

// Set up process.env
dotenv.config();

// Set up db stuffs

await mongoose.connect(`${process.env.MONGO_URL || ""}?retryWrites=true&w=majority`, {
	appName: "bot",
});
mongoose.connection.on("error", console.error);

/**
 * @type {{
 * 	[t: string]: mongoose.Model<import("../types").MessageDatabaseItem, {}, {}, {}>;
 * }}
 */
const gameDatabases = {};

const games = await Promise.all(
	fileSystem
		.readdirSync(url.fileURLToPath(new URL("./games", import.meta.url).toString()))
		.map(
			async (file) =>
				(
					await /** @type {Promise<{ default: import("../types").Game }>} */ (
						import(`./games/${file}`)
					)
				).default,
		),
);

/** @type {mongoose.SchemaDefinitionProperty<undefined | any>} */
const guildSchema = {
	id: {
		required: true,
		type: String,
		unique: true,
	},

	logs: { type: String },
};

for (const game of games) {
	gameDatabases[`${game.name}`] = mongoose.model(
		game.name,
		new mongoose.Schema({
			author: {
				required: true,
				type: String,
			},

			guild: {
				required: true,
				type: String,
			},

			id: {
				required: true,
				type: String,
				unique: true,
			},

			index: {
				required: true,
				type: Number,
				unique: false,
			},

			word: {
				lowercase: true,
				required: true,
				trim: true,
				type: String,
			},
		}),
	);
	guildSchema[`${game.name}`] = { type: String };
	guildSchema[`logs_${game.name}`] = { type: String };
}

const GuildDatabase = mongoose.model("Guild", new mongoose.Schema(guildSchema));

const Discord = new Client({
	intents: [
		intents.FLAGS.GUILDS,
		intents.FLAGS.GUILD_MESSAGES,
		intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		intents.FLAGS.DIRECT_MESSAGES,
		intents.FLAGS.DIRECT_MESSAGE_TYPING,
	],

	partials: ["USER", "REACTION", "MESSAGE"],
});

/**
 * Handle an error.
 *
 * @param {unknown} error - Error.
 * @param {(options: import("discord.js").MessageOptions) => Promise<void>} send - Function that
 *   posts the error.
 * @param {string} channel - Channel where the error occurred.
 *
 * @returns {Promise<void[] | void>} - Nothing of value.
 */
async function handleError(error, send, channel) {
	try {
		console.error(error);

		const embed = new MessageEmbed()
			.setTitle("Error!")
			.setDescription(
				`Uhoh! I found an error!\n\`\`\`json\n${JSON.stringify(error).replaceAll(
					"```",
					"[3 backticks]",
				)}\`\`\``,
			);

		const promises = [
			send({
				content: "This error has automatically been sent to the support server. If you can, please join it yourself so you can help debug this error! Link is in my bio.",
				embeds: [embed],
			}),
		];

		if (process.env.NODE_ENV === "production") {
			promises.push(
				(async () => {
					const ruleChannel = await Discord.channels.fetch("897639265696112670");

					if (ruleChannel?.isText())
						await ruleChannel.send({ content: `In ${channel}`, embeds: [embed] });
				})(),
			);
		}

		return await Promise.all(promises);
	} catch (errorError) {
		return console.error(errorError);
	}
}

Discord.on("ready", async () => {
	console.log("Connected to Discord with ID", Discord.application?.id);

	if (process.env.NODE_ENV === "production") {
		const channel = await Discord.channels.fetch("826457135415033867");

		if (channel?.isText()) await channel.send("Bot online!");
	}
})
	.on("disconnect", () => console.warn("Disconnected from Discord"))
	.on("debug", console.debug)
	.on("warn", console.warn)
	.on("error", console.error)
	.on("typingStart", async (message) => {
		await message.channel.send({ content: "No DMs, sorry!" });
	})
	.on("messageCreate", async (rawMessage) => {
		const message = rawMessage.partial ? await rawMessage.fetch() : rawMessage;
		const author = message.author.partial ? await message.author.fetch() : message.author;

		if (message.mentions.users.has(message.client.user?.id || "")) await message.react("👋");

		if (!message.guild) {
			await message.reply({ content: "No DMs, sorry!" });

			return;
		}

		if (author.id === Discord.user?.id) return;

		const guildInfo = await GuildDatabase?.findOne({ id: message.guild?.id || "" }).exec();

		if (!guildInfo) return;

		const thisGame = games.find((game) => guildInfo[game.name] === message.channel.id);

		if (!thisGame) return;

		const logChannelId = guildInfo[`logs_${thisGame.name}`] || guildInfo.logs;

		if (!logChannelId) return;

		const ruleChannel = await Discord.channels.fetch(logChannelId);

		if (!ruleChannel?.isText())
			throw new Error(`Log channel ${logChannelId} is not a text channel!`);

		/**
		 * Reject a message posted as invalid.
		 *
		 * @param {MessageEmbed} embed - Embed describing why it is invalid. Note that any `author`
		 *   set on this message will be overwritten.
		 */
		async function reject(embed) {
			embed.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() });

			if (!ruleChannel?.isText())
				throw new Error(
					`Log channel ${ruleChannel?.id || "[unknown]"} is not a text channel!`,
				);

			await Promise.all([
				message.delete(),
				ruleChannel.send({
					content: `${author.toString()} | <#${message.channel.id}>`,
					embeds: [embed],
				}),
			]);
		}

		try {
			const word = message.cleanContent
				.normalize("NFD")
				.toLowerCase()
				.trim()
				.replaceAll("`", "'");

			if (thisGame.match && !new RegExp(thisGame.match).test(word)) {
				const embed = new MessageEmbed()
					.setTitle("Invalid character sent!")
					.setDescription(`\`${word}\` contains invalid characters!`);

				return await reject(embed);
			}

			// Use Wiktionary's API to determine if it is a word
			if (
				thisGame.validWordsOnly &&
				!(
					(await isWord(word)) ||
					(await isWord(message.cleanContent)) ||
					(await isWord(message.content))
				)
			) {
				const embed = new MessageEmbed()
					.setTitle("Not a word!")
					.setDescription(`\`${word}\` is not a word!`);

				return await reject(embed);
			}

			if (thisGame.minLength && word.length < thisGame.minLength) {
				const embed = new MessageEmbed()
					.setTitle("Too short!")
					.setDescription(
						`\`${word}\` is less than ${thisGame.minLength} characters! ` +
							"Try to be a bit more creative :P",
					);

				return await reject(embed);
			}

			const GameDatabase = gameDatabases[thisGame.name];

			if (!GameDatabase) throw new Error(`Game database ${thisGame.name} not found!`);
			const lastWord = await GameDatabase.findOne({ guild: message.guild.id })
				.sort({ index: -1 })
				.exec();

			if (thisGame.manualCheck) {
				const manualCheckResult = thisGame.manualCheck(word, lastWord ?? undefined);

				if (manualCheckResult !== true) return await reject(manualCheckResult);
			}

			if (
				message.guild.id !== "823941138653773868" &&
				!thisGame.twiceInRow &&
				lastWord?.author === author.id
			) {
				const embed = new MessageEmbed()
					.setTitle("Posting twice in a row!")
					.setDescription("No posting twice in a row allowed!");

				return await reject(embed);
			}

			if (!thisGame.duplicates) {
				// Determine if it has been used before
				const used = await GameDatabase.findOne({ guild: message.guild.id, word }).exec();

				if (used) {
					const usedMessage = await message.channel.messages
						.fetch(used.id)
						.catch(() => false);

					if (typeof usedMessage === "object") {
						return await reject(
							new MessageEmbed()
								.setTitle("Duplicate word!")
								.setDescription(
									`\`${word}\` has [been used before](https://discord.com/channels/${
										usedMessage.guild?.id || ""
									}/${usedMessage.channel.id}/${used.id}) by <@${used.author}>!`,
								)
								.setThumbnail(
									(await Discord.users.fetch(used.author)).displayAvatarURL(),
								),
						);
					}
				}
			}

			// All checks out, add to db
			  const now = Date.now() / 1000;
			await Promise.all([
				new GameDatabase({
					author: author.id,
					guild: message.guild.id,
					id: message.id,
					index: (lastWord?.index ?? -1) + 1,
					word,
				}).save(),
				message.react((now < 1712059200 && now > 1711886400)?"👎": "👍"),
			]);
		} catch (error) {
			await handleError(
				error,
				async (data) => {
					await ruleChannel.send(data);
				},
				message.channel.toString(),
			);
		}
	})
	.on("interactionCreate", async (interaction) => {
		if (!interaction.isCommand())
			throw new Error(`Someone (${interaction.user.toString()}) used a button`);

		try {
			switch (interaction.commandName) {
				case "ping": {
					return await interaction.reply({ content: "Pong!", ephemeral: true });
				}
				case "invite": {
					return await interaction.reply({
						content: `https://discord.com/api/oauth2/authorize?client_id=${
							Discord.user?.id || ""
						}&permissions=2147838016&scope=bot%20applications.commands`,

						ephemeral: true,
					});
				}
			}

			if (!interaction.guild || !interaction.channel || !("guild" in interaction.channel)) {
				return await interaction.reply({
					content: "This command is not supported in DMs, sorry!",
					ephemeral: true,
				});
			}

			if (!interaction.member || !("permissionsIn" in interaction.member))
				throw new Error("Could not find member permissions");

			const guildInfo = await GuildDatabase.findOne({ id: interaction.guild.id });

			switch (interaction.commandName) {
				case "set-last": {
					if (!guildInfo) {
						return await interaction.reply({
							content: "This server does not have any games set up!",
							ephemeral: true,
						});
					}

					if (
						!interaction.member
							.permissionsIn(interaction.channel)
							.has("MANAGE_MESSAGES")
					) {
						return await interaction.reply({
							content: "You are lacking Manage Messages permission, sorry!",
							ephemeral: true,
						});
					}

					const last = interaction.options.getString("message");

					if (!last) {
						return await interaction.reply({
							content: "Please specify what to force-post!",
							ephemeral: true,
						});
					}

					const game = games.find(
						({ name }) => guildInfo[`${name}`] === interaction.channel?.id,
					);

					if (!game) {
						return await interaction.reply({
							content: "There are no games in this channel!",
							ephemeral: true,
						});
					}

					const GameDatabase = gameDatabases[game.name];

					if (!GameDatabase) throw new Error("Game is missing a database");

					const message = await interaction.reply({
						content: last.replaceAll(/(?<character>[*<_`|~])/g, "\\$<character>"),
						fetchReply: true,
					});

					/** @type {Promise<any>[]} */
					const promises = [
						new GameDatabase({
							author: Discord.user?.id,
							guild: interaction.guild.id,
							id: message.id,

							index:
								((
									await GameDatabase.findOne({ guild: interaction.guild.id })
										.sort({ index: -1 })
										.exec()
								)?.index ?? -1) + 1,

							word: last,
						}).save(),
					];

					if ("react" in message) promises.push(message?.react("👍").catch(()=>{}));

					await Promise.all(promises);

					break;
				}

				case "set-game": {
					if (
						!interaction.member
							?.permissionsIn?.(interaction.channel)
							.has("MANAGE_GUILD")
					) {
						return await interaction.reply({
							content: "You are lacking Manage Server permission, sorry!",
							ephemeral: true,
						});
					}

					const game = interaction.options.getString("game");

					if (!game) {
						return await interaction.reply({
							content: "Please specify a game!",
							ephemeral: true,
						});
					}

					if (guildInfo) {
						if (
							Object.values({ ...guildInfo, id: undefined }).includes(
								interaction.channel?.id,
							)
						) {
							return await interaction.reply({
								content: "This channel is already in use!",
								ephemeral: true,
							});
						}

						await GuildDatabase.updateOne(
							{ id: interaction.guild.id },
							{ [game]: interaction.channel?.id },
						);
					} else {
						await new GuildDatabase({
							[game]: interaction.channel?.id,
							id: interaction.guild.id,
						}).save();
					}

					return await interaction.reply({
						content: `This channel has been initialized for a game of ${game}!`,
					});
				}
				case "set-logs": {
					if (
						!interaction.member
							?.permissionsIn?.(interaction.channel)
							.has("MANAGE_GUILD")
					) {
						return await interaction.reply({
							content: "You are lacking Manage Server permission, sorry!",
							ephemeral: true,
						});
					}

					const game = interaction.options.getString("game");

					if (game) {
						if (guildInfo) {
							if (
								Object.entries({ ...guildInfo, id: undefined }).some(
									(item) =>
										!item[0].startsWith("logs_") &&
										item[1] === interaction.channel?.id,
								)
							) {
								return await interaction.reply({
									content: "This channel is already in use!",
									ephemeral: true,
								});
							}

							await GuildDatabase.updateOne(
								{ id: interaction.guild.id },
								{ [`logs_${game}`]: interaction.channel?.id },
							);
						} else {
							await new GuildDatabase({
								id: interaction.guild.id,
								[`logs_${game}`]: interaction.channel?.id,
							}).save();
						}

						return await interaction.reply({
							content: `Logs for ${game} will be posted here!`,
						});
					}

					await Promise.all([
						guildInfo
							? GuildDatabase.updateOne(
									{ id: interaction.guild.id },
									{ logs: interaction.channel?.id },
							  )
							: new GuildDatabase({
									id: interaction.guild.id,
									logs: interaction.channel?.id,
							  }).save(),
						interaction.reply({
							content: "Logs will be posted here if no game-specific channel is set!",
						}),
					]);
				}
			}
		} catch (error) {
			await handleError(
				error,
				async (data) => await interaction.reply({ ...data, ephemeral: true }),
				interaction.channel?.toString() || "",
			);
		}
	})
	.login(process.env.BOT_TOKEN || "")
	.catch((error) => {
		throw new Error(error);
	});
