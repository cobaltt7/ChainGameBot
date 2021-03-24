(async function () {
	try {
		require("dotenv").config();
		const axios = require("axios");
		const fetch = axios.method;
		axios.defaults.headers.common["User-Agent"] =
			"Shirtori Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Shitori game // " +
			"https://github.com/RedGuy12/ShitoriBot";

		console.log(
			await axios.post("https://paul-s-reid.com/web-dev/ShitoriBotApi-php/index.php", {
				API_ACCESS_KEY: process.env.API_ACCESS_KEY,
			}),
		);
		const Database = function (query, placeholders = []) {
			return fetch({
				url: "https://paul-s-reid.com/web-dev/ShitoriBotApi-php/index.php",
				method: "post",
				data: {
					API_ACCESS_KEY: process.env.API_ACCESS_KEY,
					query: query,
					placeholders: placeholders,
				},
			});
		};

		const Discord = require("discord.js");
		const client = new Discord.Client();
		client.on("ready", () => {
			console.log(`Connected to Discord`);
		});

		client.on("message", async (msg) => {
			if (msg.channel.id === "823941849453821982") {
				const response = await fetch({
					method: "get",
					url:
						"https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&" +
						`page=${msg.content.toLowerCase()}`,
				});
				if (response.data.error) {
					msg.delete();
					client.channels.cache
						.get("823941821695918121")
						.send(`${msg.author} - \`${msg.content.toLowerCase()}\`` + "is not a word!");
					return;
				}
				try {
					await Database("INSERT INTO words (word, author, id, server, channel) VALUES ($1,$2,$3,$4,$5);", [
						msg.content.toLowerCase(),
						msg.author.toString(),
						msg.id,
						msg.channel.guild.id,
						msg.channel.id,
					]);
				} catch {}
			}
		});

		client.login(process.env.BOT_TOKEN);
	} catch (e) {
		console.error(e);
	}
})();
