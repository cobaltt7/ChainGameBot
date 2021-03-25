(async function () {
	try {
		// set up process.env
		require("dotenv").config();

		// set up axios
		const fetch = require("axios");
		fetch.defaults.headers.common["User-Agent"] =
			"Shirtori Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Shitori game // " +
			"https://github.com/RedGuy12/ShitoriBot"; // so Wiktionary won't ban us

		//set up db stuffs
		const DatabaseQuery = (query) => {
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
				var word = msg.content.toLowerCase().replace(/\s/gi, "");

				// use Wiktionary's API to determine if it is a word
				var response = await fetch({
					method: "get",
					url:
						"https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&" +
						`page=${word}`,
				});
				if (response.data.error) {
					msg.delete();
					Discord.channels.cache.get("823941821695918121").send(`${msg.author} - \`${word}\` is not a word!`);
					return;
				}

				// determine if it starts with the last letter of the previous word
				var lastWord = (
					await DatabaseQuery("SELECT `word` FROM `shitori_words` ORDER BY `index` DESC LIMIT 1;")
				).data["0"];
				if (lastWord.word.slice(-1) !== word[0]) {
					msg.delete();
					Discord.channels.cache
						.get("823941821695918121")
						.send(`${msg.author} - \`${word}\` does not start with ${lastWord.word.slice(-1)}!`);
					return;
				}

				// determine if it has been used before
				var used = (
					await DatabaseQuery(
						"SELECT `author`, `id`, `guild` FROM `shitori_words` WHERE `word`='" + word + "'",
					)
				).data["0"];
				if (used !== "{") {
					// idk why this works but for some reason it does
					msg.delete();
					Discord.channels.cache
						.get("823941821695918121")
						.send(
							`${msg.author} - \`${word}\` has been used before by ${
								used.author
							}!\nSee https://discord.com/channels/${Discord.channels.cache.get(used.channel).guild.id}/${
								used.channel
							}/${used.id}`,
						);
					return;
				}

				// all checks out, add to db
				await DatabaseQuery(
					`INSERT INTO shitori_words (word, author, id, guild) VALUES (${escape(word)}, ${escape(
						msg.author.username,
					)}, ${escape(msg.id)}, ${escape(msg.channel.guild.id)});`,
				);
			}
		});

		Discord.login(process.env.BOT_TOKEN);
	} catch (e) {
		console.error(e);
	}
})();
