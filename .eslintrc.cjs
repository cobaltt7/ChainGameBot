/** @file ESLint Configuration file. */
"use strict";

/** @type {import("eslint").Linter.Config} */
const config = {
	extends: ["plugin:@redguy12/recommended", "plugin:@redguy12/node"],

	overrides: [
		{
			files: ["!**.md/*"],
			parserOptions: { project: "./jsconfig.json" },
		},

		{
			extends: ["plugin:@redguy12/esm"],
			files: ["**.js"],
		},
	],

	parserOptions: { ecmaVersion: "latest" },
	root: true,

	rules: {
		"id-length": [
			2,
			{
				exceptions: ["_", "id"],
				max: 20,
				min: 3,
			},
		],

		"no-console": 0,
		"no-underscore-dangle": [2, { allow: ["_id"], enforceInMethodNames: true }],
	},
};

module.exports = config;
