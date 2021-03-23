(async function () {
	try {
		require("dotenv").config();

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
			console.log(msg);
			return;
			try {
				await Database.query();
			} catch {}
		});

		client.login(process.env.BOT_TOKEN);
	} catch (e) {
		console.error(e);
	}
})();
