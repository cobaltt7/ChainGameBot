(async function () {
	try {
		require("dotenv").config();

		const axios = require("axios");
		const headers = {
			headers: {
				"User-Agent":
					"Shirtori Discord Bot by Paul Reid\n" +
					"A Discord bot to enforce the rules of the Shitori game" +
					"https://github.com/RedGuy12/ShitoriBot",
			},
		};
		console.log(await axios.get("https://paul-s-reid.com/web-dev/ShitoriBotApi-php/index.php"));

		const SQL = require("pg").Client;
		const Database = new SQL({
			connectionString: process.env.DATABASE_URL,
			ssl: {
				rejectUnauthorized: false,
			},
		});
		await Database.connect();
		console.log("Connected to Postgres");
		await Database.query(
			"CREATE TABLE IF NOT EXISTS words(\
			word character varying(183) NOT NULL,\
			author character varying(37) NOT NULL,\
			id integer NOT NULL,\
			server integer NOT NULL,\
			channel integer NOT NULL,\
			PRIMARY KEY (word, server, channel),\
			UNIQUE (word)\
		);",
		);

		const Discord = require("discord.js");
		const client = new Discord.Client();
		client.on("ready", () => {
			console.log(`Connected to Discord`);
		});

		client.on("message", async (msg) => {
			if (msg.channel.id === "823941849453821982") {
				const url =
					"https://en.wiktionary.org/w/api.php?action=parse&summary" +
					"=example&format=json&redirects=true&page=" +
					msg.content.toLowerCase();
				const response = await axios.get(url, headers);
				if (response.data.error) {
					msg.delete();
					client.channels.cache
						.get("823941821695918121")
						.send(
							`${msg.author} - \`${msg.content.toLowerCase()}\`` +
								"is not a word!",
						);
					return;
				}
				try {
					await Database.query(
						"INSERT INTO words (word, author, id, server, channel)\
						VALUES ($1,$2,$3,$4,$5);",
						[
							msg.content.toLowerCase(),
							msg.author.toString(),
							msg.id,
							msg.channel.guild.id,
							msg.channel.id,
						],
					);
				} catch {}
			}
		});

		client.login(process.env.BOT_TOKEN);
	} catch (e) {
		console.error(e);
	}
})();
