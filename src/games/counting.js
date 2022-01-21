/** @file Game To count from 1 up. */
import { MessageEmbed } from "discord.js";

/** @type {import("../../types").Game} */
const command = {
	duplicates: true,

	manualCheck(number, last) {
		const lastNumber = Math.floor(Math.max(+(last?.word || 0) || 0, 0));

		if (+number !== lastNumber + 1) {
			return new MessageEmbed()
				.setTitle("Incorrect number!")
				.setDescription(`\`${number}\` does not come after \`${lastNumber}\`!`);
		}

		return true;
	},

	match: /^[\d+.-]+$/,
	name: "Counting",
	twiceInRow: process.env.NODE_ENV !== "production",
	validWordsOnly: false,
};

export default command;
