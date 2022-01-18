/** @file A Game to post a word tht starts with the first letter of the previous word. */
import { MessageEmbed } from "discord.js";

/** @type {import("../../types").Game} */
const command = {
	duplicates: false,

	manualCheck(word, lastWord) {
		// Determine if it starts with the last letter of the previous word
		const shouldStartWith = lastWord?.word.slice(-1).replace("`", "'");

		if (shouldStartWith && shouldStartWith !== word[0]) {
			return new MessageEmbed()
				.setTitle("Doesn't start with correct character!")
				.setDescription(`\`${word}\` does not start with \`${shouldStartWith}\`!`);
		}

		return true;
	},

	match: /^[\d '\u00A0-\uD7FF\uFA6E-\uFDCF\p{L}-]+$/gimu,
	minLength: 4,
	name: "Word Chain",
	twiceInRow: process.env.NODE_ENV !== "production",
	validWordsOnly: true,
};

export default command;
