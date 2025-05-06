import type { Snowflake } from "discord.js";

const env =
	process.argv.some((file) => file.endsWith(".test.js")) ? "testing"
	: process.env.NODE_ENV === "production" ? "production"
	: "development";

export default {
	channels: { logs: "897639265696112670" },

	collectorTime: 45_000,

	emojis: {
		message: {
			add: "<:emoji:0>",
			boost: "<:emoji:0>",
			call: "<:emoji:0>",
			checkmark: "<:emoji:0>",
			edit: "<:emoji:0>",
			error: "<:emoji:0>",
			fail: "<:emoji:0>",
			forward: "<:emoji:0>",
			live: "<:emoji:0>",
			loading: "<a:emoji:0>",
			pin: "<:emoji:0>",
			poll: "<:emoji:0>",
			raisedHand: "<:emoji:0>",
			remove: "<:emoji:0>",
			reply: "<:emoji:0>",
			sad: "<:emoji:0>",
			speaker: "<:emoji:0>",
			stage: "<:emoji:0>",
			subscription: "<:emoji:0>",
			success: "<:emoji:0>",
			thread: "<:emoji:0>",
			warning: "<:emoji:0>",
		},
		statuses: { no: "<:emoji:1325338058542813275>", yes: "<:emoji:1325338022207684797>" },
	} satisfies Record<string, Record<string, `<${"a" | ""}:emoji:${Snowflake}>`>>,

	env,

	testingServer: "823941138653773868",
	themeColor: 0xe9_ea_ea,

	users: { bot: "823932474118635540" },
} as const;
