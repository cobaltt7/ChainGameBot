require("dotenv").config();

const Discord = require("discord.js");
const client = new Discord.Client();

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!!!!`);
});

client.on("message", (msg) => {
	const channel = client.channels.cache.get("823941849453821982");
	channel.messages.fetch({ limit: 2 }).then((messages) => {
		console.log(messages)
		if (
			messages[1].content[
				messages[1].content.length - 1
			].toLowerCase() !== msg.content[0].toLowerCase()
		) {
			client.channels.cache.get("823941821695918121").send("Pong");
		}
	});
});

client.login(process.env.BOT_TOKEN);
