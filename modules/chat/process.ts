import type {
	Awaitable,
	CategoryChannel,
	Guild,
	GuildBasedChannel,
	GuildMember,
	Message,
	PrivateThreadChannel,
	User,
} from "discord.js";

import {
	channelMention,
	ChannelType,
	Collection,
	messageLink,
	PermissionFlagsBits,
	roleMention,
	SnowflakeUtil,
	userMention,
} from "discord.js";
import {
	client,
	GlobalChannelsPattern,
	GlobalEmojiPattern,
	GlobalGuildTemplatesPattern,
	GlobalInvitesPattern,
	GlobalLinkedRolePattern,
	GlobalRolesPattern,
	GlobalUsersPattern,
} from "strife.js";

import { GlobalBotInvitesPattern, messageToText } from "../../util/discord.ts";
import { normalize } from "../../util/text.ts";

const defaultUser = userMention("0");
const defaultChannel = channelMention("0");
const defaultRole = roleMention("0");
const clientUser = client.user.toString();

function anonymizeMentions(string: string, author: GuildMember | User): string {
	return string
		.replaceAll(author.toString(), defaultUser)
		.replaceAll(GlobalUsersPattern, clientUser)
		.replaceAll(GlobalChannelsPattern, defaultChannel)
		.replaceAll(GlobalRolesPattern, defaultRole)
		.replaceAll(GlobalLinkedRolePattern, "<id:linked-roles>")
		.replaceAll(
			/https?:\/\/\w+\.discord(?:app)?\.com\/channels\/(?<guild>\d{17,20}|@me)\/(?<channel>\d{17,20})\/(?<message>\d{17,20})/gi,
			messageLink("0", "0", "guild" in author ? author.guild.id : "@me"),
		)
		.replaceAll(
			/https?:\/\/\w+\.discord(?:app)?\.com\/channels\/(?<guild>\d{17,20}|@me)\/(?<channel>\d{17,20})/gi,
			defaultChannel,
		)
		.replaceAll(
			/https?:\/\/\w+\.discord(?:app)?\.com\/channels\/(?<guild>\d{17,20}|@me)/gi,
			`https://discord.com/channels/${"guild" in author ? author.guild.id : "@me"}`,
		);
}

export function processPrompt(message: Message): string {
	return anonymizeMentions(
		normalize(messageToText(message, false)),
		message.member ?? message.author,
	)
		.replaceAll(GlobalEmojiPattern, ":$<name>:")
		.replaceAll(
			/\[(?<name>.+)]\(https?:\/\/cdn\.discordapp\.com\/emojis\/\d{17,20}\.\w+(?:[#?][\w!#$%&'()*+,./:;=?@~-]*)?\)/gi,
			":$<name>:",
		)
		.replaceAll(
			/https?:\/\/cdn\.discordapp\.com\/emojis\/\d{17,20}\.\w+\?(?:[\w!$%&'()*+,./:;=?@~-]+&)?name=(?<name>\w+)[\w!#$%&'()*+,./:;=?@~-]*/gi,
			":$<name>:",
		)
		.replaceAll(
			/https?:\/\/cdn\.discordapp\.com\/emojis\/\d{17,20}\.\w+(?:[#?][\w!#$%&'()*+,./:;=?@~-]*)?/gi,
			":emoji:",
		);
}
export function preProcessResponse(message: Message): string | undefined {
	const response = anonymizeMentions(
		messageToText(message, false),
		message.member ?? message.author,
	)
		.replaceAll(GlobalEmojiPattern, "<:$<name>:0>")
		.replaceAll(
			/\[(?<name>.+)]\(https?:\/\/cdn\.discordapp\.com\/emojis\/\d{17,20}\.\w+(?:[#?][\w!#$%&'()*+,./:;=?@~-]*)?\)/gi,
			"<:$<name>:0>",
		)
		.replaceAll(
			/https?:\/\/cdn\.discordapp\.com\/emojis\/\d{17,20}\.\w+\?(?:[\w!$%&'()*+,./:;=?@~-]+&)?name=(?<name>\w+)[\w!#$%&'()*+,./:;=?@~-]*/gi,
			"<:$<name>:0>",
		)
		.replaceAll(
			/https?:\/\/cdn\.discordapp\.com\/emojis\/\d{17,20}\.\w+(?:[#?][\w!#$%&'()*+,./:;=?@~-]*)?/gi,
			"<:emoji:0>",
		)
		.trim();

	if (
		response === ""
		|| response.length > 500
		|| response.split("\n").length > 5
		|| response.match(GlobalInvitesPattern)?.length
		|| response.match(GlobalGuildTemplatesPattern)?.length
		|| response.match(GlobalBotInvitesPattern)?.length
	)
		return;

	return response;
}
export async function postProcessResponse(response: string, author: GuildMember): Promise<string> {
	const noUsers = response
		.replaceAll(GlobalUsersPattern, clientUser)
		.replaceAll(defaultUser, author.toString());
	const noChannels = await replaceChannels(noUsers, author.guild);
	const noRoles = await replaceRoles(noChannels, author.guild);
	const noEmojis = await replaceEmojis(noRoles, author.guild);
	return noEmojis;
}

async function replaceChannels(response: string, guild: Guild): Promise<string> {
	const links = response.match(/https?:\/\/\w+\.discord.com\/channels\/(?:\d+|@me)\/\d+\/\d+/gi);
	if (!links && !response.includes(defaultChannel)) return response;

	const channels = (await guild.channels.fetch()).filter(
		(channel): channel is Exclude<NonNullable<typeof channel>, CategoryChannel> =>
			channel?.type !== ChannelType.GuildCategory
			&& !!channel
				?.permissionsFor(guild.roles.everyone)
				.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory),
	);
	const threads = (await guild.channels.fetchActiveThreads()).threads.filter(
		(channel): channel is Exclude<typeof channel, PrivateThreadChannel> =>
			channel.type !== ChannelType.PrivateThread
			&& channel
				.permissionsFor(guild.roles.everyone)
				.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory),
	);
	const mentionableChannels = Collection.combineEntries<
		string,
		Exclude<GuildBasedChannel, CategoryChannel>
	>([...channels.entries(), ...threads.entries()], (value) => value);
	const textChannels = mentionableChannels.filter((channel) => channel.isTextBased());

	return await (links ?? []).reduce<Awaitable<string>>(
		async (accumulated, link) => {
			const channel = textChannels.random();
			if (!channel) return (await accumulated).replace(link, defaultChannel);

			const createdAt = SnowflakeUtil.timestampFrom(channel.id);
			const timestamp = Math.round(createdAt + Math.random() * (Date.now() - createdAt));

			const message = await channel.messages.fetch({
				limit: 1,
				around: SnowflakeUtil.generate({ timestamp }).toString(),
			});
			return (await accumulated).replace(link, (message.first() ?? channel).url);
		},
		response.replaceAll(
			defaultChannel,
			() => mentionableChannels.random()?.toString() ?? defaultChannel,
		),
	);
}
async function replaceRoles(response: string, guild: Guild): Promise<string> {
	if (!response.includes(defaultRole)) return response;

	const roles = await guild.roles.fetch();
	return response.replaceAll(defaultRole, () => roles.random()?.toString() ?? "");
}
async function replaceEmojis(response: string, guild: Guild): Promise<string> {
	if (!GlobalEmojiPattern.test(response)) return response;

	const emojis = await guild.emojis.fetch();
	return response.replaceAll(GlobalEmojiPattern, () => emojis.random()?.toString() ?? "");
}
