require("dotenv").config();

const Discord = require("discord.js");
const client = new Discord.Client();
const SQL = require("pg").Client;
const Database = new SQL({
	user: process.env.DATABASE_USER,
	password: process.env.DATABSE_PASSWORD,
	host: process.env.DATABASE_HOST,
	port: process.env.DATABASE_PORT,
	database: process.env.DATABASE_NAME,
});
Database.connect()
	.then(console.log("Connected to Postgres"))
	.catch(console.error);
client.on("ready", () => {
	console.log(`Connected to Discord`);
});

client.on("message", (msg) => {
	const channel = client.channels.cache.get("823941849453821982");
	channel.messages.fetch({ limit: 2 }).then((messages) => {
		console.log(messages);
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
