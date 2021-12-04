import { MessageEmbed } from "discord.js";

export default {
	name: "Counting",
	match: /^\d+$/,
	validWordsOnly: false,
	twiceInRow: true, //process.env.NODE_ENV !== "production",
	duplicates: false,
	manualCheck(number, {word: lastNumber = 0}) {
		if (+number !== (+lastNumber + 1)) {
			return new MessageEmbed()
				.setTitle("Incorrect number!")
				.setDescription(`\`${number}\` does not come after \`${lastNumber}\`!`);
		}
		return true;
	},
};
