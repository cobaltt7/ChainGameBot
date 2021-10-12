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
	fileSystem.readdirSync(`${new URL("./games", import.meta.url)}`).map(async (file) => {
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
	],
});
Discord.once("ready", () => console.log(`Connected to Discord with id`, Discord.application?.id))
	.on("debug", console.debug)
	.on("warn", console.warn)
	.on("error", console.error)
	.on("messageCreate", async (msg) => {
		const guildInfo = await databases.Guilds.findOne({ id: msg.guild?.id||"" }).exec();
		if (!guildInfo) return;
		const game = games.find((game) => guildInfo[game.name] === msg.channelId);
		if (!game) return;
		/** @type {TextChannel | undefined} */
		// @ts-expect-error -- It's impossible for this to be set as a non-text channel.
		const ruleChannel = Discord.channels.cache.get(CHANNELS.rules);
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
					method: "get",
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

			const lastWord = await databases.Game.findOne().sort({ index: -1 }).exec();

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
				const used = await databases.Game.findOne({ word }).exec();
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
			await new databases.Game({
				word,
				author: msg.author.id,
				id: msg.id,
				index: (lastWord?.index ?? -1) + 1,
			}).save();

			await msg.react("👍");
			return;
		} catch (error) {
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
				if (!pingMe) {
					// todo dm me?
				}
				ruleChannel.send({
					[pingMe ? "content" : ""]: pingMe ? "<@" + ME_ID + ">" : "",
					embeds: [embed],
				});
				return;
			} catch (errorError) {
				console.error(errorError);
			}
		}
	}); //.on();

Discord.login(process.env.BOT_TOKEN);
