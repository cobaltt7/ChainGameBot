(async function () {
	try {
		require("dotenv").config();

		const axios = require("axios");

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
					msg.content;
				const response = await axios.get(url);
				if (response.data.error) {
					msg.delete();
					client.channels.cache
						.get("823941821695918121")
						.send(
							`${msg.author} - \`${msg.content}\` is not a word!`,
						);
					return;
				}
				try {
					await Database.query();
				} catch {}
			}
		});

		client.login(process.env.BOT_TOKEN);
	} catch (e) {
		console.error(e);
	}
})();
