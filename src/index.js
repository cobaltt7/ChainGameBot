import dotenv from "dotenv";
import fetch from "axios";
import mongoose from "mongoose";
import {Client,Intents as intents,MessageEmbed} from "discord.js";

// set up process.env
dotenv.config();

const CHANNELS = {game: "823941849453821982", rules: "823941821695918121"}
const ME_ID = "771422735486156811"

// so Wiktionary won't ban us
fetch.defaults.headers.common["User-Agent"] =
	"Word Chain Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Word Chain game // " +
	"https://github.com/RedGuy12/ShitoriBot";

//set up db stuffs

await mongoose.connect(`${process.env.MONGO_URL}?retryWrites=true&w=majority`, {
	appName: "bot",
});
mongoose.connection.on("error", console.error);

const Database = mongoose.model(
	"Shitori",
	new mongoose.Schema({
		word: {
			type:String,required:true,unique:true,lowercase:true,trim:true

		},
		author: {
			type:String,required:true,
		},
		id: {
			type:String,unique:true,required:true
		},
		index:{
			type:Number,required:true,unique:true
		}
	}),
);

const Discord = new Client({intents:[intents.FLAGS.GUILDS,intents.FLAGS.GUILD_MESSAGES]});
Discord.once("ready", () =>
	console.log(`Connected to Discord`)
).on('debug', console.debug)
.on('warn', console.warn)
.on('error', console.error).on("messageCreate", async (msg) => {
	if (msg.channelId !== CHANNELS.game) return;
	try {
		var word = msg.content.toLowerCase().trim().replaceAll("`","'");

		// don't allow whitespace
		if (/\s/.test(word)) {
			msg.delete();

			const embed = new MessageEmbed()
				.setTitle('Multiple words sent!')
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setDescription(`\`${word}\` is more than one word!`);

			Discord.channels.cache
				.get(CHANNELS.rules)
				.send({
					content: msg.author.toString(), embeds: [embed],
					allowedMentions: {users: [msg.author.id]}
				}
				);
			return;
		}

		// use Wiktionary's API to determine if it is a word
		var response = await fetch({
			method: "get",
			url:
				`https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&page=${word}`, // todo not wikitionary
		});
		if (response.data.error) {
			msg.delete();

			const embed = new MessageEmbed()
				.setTitle('Not a word!')
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setDescription(`\`${word}\` is not a word!`);

			Discord.channels.cache
				.get(CHANNELS.rules)
				.send({
					content: msg.author.toString(), embeds: [embed]
				}
				);
			return;
		}

		// determine if it starts with the last letter of the previous word
		const lastWord = (await Database.findOne().sort({index: -1}).exec());
		const shouldStartWith = lastWord?.word.slice(-1).replace("`","'");
		if (shouldStartWith && shouldStartWith !== word[0]) {
			msg.delete();

			const embed = new MessageEmbed()
				.setTitle('Doesn\'t start with correct character!')
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setDescription(`\`${word}\` does not start with ${shouldStartWith}!`);

			Discord.channels.cache
				.get(CHANNELS.rules)
				.send({
					content: msg.author.toString(), embeds: [embed],
				}
				);
			return;
		}

		if (lastWord?.author===msg.author.id) {
			msg.delete();

			const embed = new MessageEmbed()
				.setTitle('Posting twice in a row!')
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setDescription(`No posting twice in a row allowed!`);

			Discord.channels.cache
				.get(CHANNELS.rules)
				.send({
					content: msg.author.toString(), embeds: [embed],
				}
				);
			return;
		}

		// determine if it has been used before
		var used = await Database.findOne({word}).exec();
		if (used) {
			msg.delete();
			const usedMsg = await msg.channel.messages.fetch(used.id);
			const embed = new MessageEmbed()
				.setTitle('Duplicate word!')
				.setAuthor(msg.author.tag, msg.author.displayAvatarURL())
				.setDescription(`\`${word}\` has [been used before](https://discord.com/channels/${usedMsg.guildId
					}/${usedMsg.channelId}/${used.id}) by <@${used.author
					}>!`)
				.setThumbnail((await Discord.users.fetch(used.author)).displayAvatarURL());

			Discord.channels.cache
				.get(CHANNELS.rules)
				.send({
					content: msg.author.toString(), embeds: [embed],
				}
				);
			return;
		}

		// all checks out, add to db
		await new Database({word, author: msg.author.id, id: msg.id, index: (lastWord?.index ?? -1) + 1}).save();
	} catch (error) {
		try {
			console.error(error);

			const ruleChannel = Discord.channels.cache
				.get(CHANNELS.rules);
			const pingMe=await ruleChannel.guild.members.fetch(ME_ID)
			const embed = new MessageEmbed()
				.setTitle('Error!')
				.setDescription(`Uhoh! I found an error!\n\`\`\`json\n${JSON.stringify(error.replaceAll("```","[3 backticks]"))}\`\`\``); // todo dm me?
			ruleChannel.send({
				[pingMe?"content":""]: pingMe?"<@"+ME_ID+">":"",
				embeds: [embed],
				allowedMentions: {users: [msg.author.id]}
			}
			);
			return;
		}catch(errorError){console.error(errorError)}
	}
});

Discord.login(process.env.BOT_TOKEN);
