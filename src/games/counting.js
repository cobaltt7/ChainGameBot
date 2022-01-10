import { MessageEmbed } from "discord.js";

/** @type {import("../../types").Game} */
const command= {
	name: "Counting",
	match: /^\d+$/,
	validWordsOnly: false,
	twiceInRow: process.env.NODE_ENV !== "production",
	duplicates: false,
	manualCheck(number, last) {
const lastNumber=+(last?.word || 0);
		if (+number !== (lastNumber + 1)) {
			return new MessageEmbed()
				.setTitle("Incorrect number!")
				.setDescription(`\`${number}\` does not come after \`${lastNumber}\`!`);
		}
		return true;
	},
};
export default command;
