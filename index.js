(async function () {
	try {
		require("dotenv").config();
		const fetch = require("axios");
		fetch.defaults.headers.common["User-Agent"] =
			"Shirtori Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Shitori game // " +
			"https://github.com/RedGuy12/ShitoriBot";

		const DatabaseQuery = function (query) {
			return fetch({
				url: "https://paul-s-reid.com/web-dev/ShitoriBotApi-php/index.php",
				method: "post",
				data: {
					API_ACCESS_KEY: process.env.API_ACCESS_KEY,
					query: query,
				},
			});
		};
		const { escape } = require("sqlstring");

		var Discord = require("discord.js");
		Discord = new Discord.Client();
		Discord.on("ready", () => {
			console.log(`Connected to Discord`);
		});

		Discord.on("message", async (msg) => {
			if (msg.channel.id === "823941849453821982") {
				const response = await fetch({
					method: "get",
					url:
						"https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&" +
						`page=${msg.content.toLowerCase()}`,
				});
				if (response.data.error) {
					msg.delete();
					Discord.channels.cache
						.get("823941821695918121")
						.send(`${msg.author} - \`${msg.content.toLowerCase()}\`` + "is not a word!");
					return;
				}
				var used = await DatabaseQuery(
					"SELECT `author`, `id`, `channel`, `server` FROM `shitori_words` WHERE `word`='" +
						escape(msg.content.toLowerCase()) +
						"'",
				);
				await DatabaseQuery(
					`INSERT INTO words (word, author, id, server, channel) VALUES (${escape(
						msg.content.toLowerCase(),
					)}, ${escape(msg.author.toString())}, ${escape(msg.id)}, ${escape(msg.channel.guild.id)}, ${escape(
						msg.channel.id,
					)});`,
				);
			}
		});

		Discord.login(process.env.BOT_TOKEN);
	} catch (e) {
		console.error(e);
	}
})();
