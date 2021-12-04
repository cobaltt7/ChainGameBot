
import axios from "axios";

export default async function isWord(word) {
	/** @type {any} */
	const response = await axios({
		headers: {
			"User-Agent":
				"Word Chain Discord Bot by Paul Reid // A Discord bot to enforce the rules of the Word Chain game // https://github.com/RedGuy12/ShitoriBot",
		},
		method: "GET",
		url: `https://en.wiktionary.org/w/api.php?action=parse&summary=example&format=json&redirects=true&page=${word}`,
	});
	if (response.data.error|| !response.data.parse.sections.find((section) => section.line==="English")) {
		return false;
	}
	return true;
}
}
