import { MessageEmbed } from "discord.js";

export default {
	name: "Word Chain",
	whitespace: false,
	validWordsOnly: true,
	twiceInRow: process.env.NODE_ENV !== "production",
	duplicates: false,
	manualCheck(word, lastWord) {
		// determine if it starts with the last letter of the previous word
		const shouldStartWith = lastWord?.word.slice(-1).replace("`", "'");
		if (shouldStartWith && shouldStartWith !== word[0]) {
			return new MessageEmbed()
				.setTitle("Doesn't start with correct character!")
				.setDescription(`\`${word}\` does not start with ${shouldStartWith}!`);
		}
		return true;
	},
};
