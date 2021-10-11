import dotenv from "dotenv";
import fetch from "axios";
import mongoose from "mongoose";
import discordJs from "discord.js";

// set up process.env
dotenv.config();

const CHANNELS = {game: "823941849453821982", rules: "823941821695918121"}

// so Wiktionary won't ban us
fetch.defaults.headers.common["User-Agent"] =
	"Word Chain Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Word Chain game // " +
	"https://github.com/RedGuy12/ShitoriBot";

//set up db stuffs

await mongoose.connect(`${process.env.MONGO_URL}?retryWrites=true&w=majority`, {
	appName: "OneAuth",
});
mongoose.connection.on("error", console.error);

const Database = mongoose.model(
	"Shitori",
	new mongoose.Schema({
		word: {
			type:String,required:true,unique:true,lowercase:true,trim:true

		},
		author: {
			type:Number,required:true,
		},
		id: {
			type:Number,unique:true,required:true
		},
		index:{
			type:Number,required:true,unique:true
		}
	}),
);

const Discord = new discordJs.Client();
Discord.on("ready", () => {
	console.log(`Connected to Discord`);
});

Discord.on("message", async (msg) => {
	if (msg.channel.id !== CHANNELS.game) return;
	try {
		var word = msg.content.toLowerCase().trim();

		// don't allow whitespace
		if (/\s/.test(word)) {
			msg.delete();
			Discord.channels.cache
				.get(CHANNELS.rules)
				.send(`${msg.author} - \`${word}\` is more than one word!`);
			return;
		}

		// use Wiktionary's API to determine if it is a word
		var response = await fetch({
			method: "get",
			url:
				`https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&page=${word}`,
		});
		if (response.data.error) {
			msg.delete();
			Discord.channels.cache
				.get(CHANNELS.rules)
				.send(`${msg.author} - \`${word}\` is not a word!`);
			return;
		}

		// determine if it starts with the last letter of the previous word
		const lastWord=(await Database.findOne().sort({index:-1}).exec())
		const shouldStartWith=lastWord?.word.slice(-1)
		if (shouldStartWith&&shouldStartWith !== word[0]) {
			msg.delete();
			Discord.channels.cache
				.get(CHANNELS.rules)
				.send(
					`${msg.author} - \`${word}\` does not start with ${shouldStartWith}!`,
				);
			return;
		}

		// determine if it has been used before
		var used = await Database.findOne({word: word}).exec();
		if (used) {
			msg.delete();
			Discord.channels.cache
				.get(CHANNELS.rules)
				.send(
					`${msg.author} - \`${word}\` has been used before by ${
						used.author
					}!\nSee https: //discord.com/channels/${
						used.guild
					}/${used.channel}/${used.id}`,
				);
			return;
		}

		// all checks out, add to db
		await new Database({word, author:msg.author.id, id:msg.id, index:(lastWord?.index?? -1)+1}).save();
	}catch(error){
		Discord.channels.cache
			.get(CHANNELS.rules)
			.send(`Uhoh! I found an error!\n\n\`\`\`js\n${error.message}\`\`\``)
				}
});

Discord.login(process.env.BOT_TOKEN);
