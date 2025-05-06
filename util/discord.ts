import type {
	APIEmbed,
	Awaitable,
	Channel,
	Embed,
	EmojiIdentifierResolvable,
	Message,
	MessageReaction,
	MessageSnapshot,
	SendableChannels,
	Snowflake,
} from "discord.js";

import {
	channelLink,
	channelMention,
	DiscordAPIError,
	hyperlink,
	messageLink,
	MessageType,
	PermissionFlagsBits,
	RESTJSONErrorCodes,
	time,
	TimestampStyles,
} from "discord.js";
import { client, escapeAllMarkdown, mentionChatCommand, stripMarkdown } from "strife.js";

import constants from "../common/constants.ts";
import { formatDuration } from "./numbers.ts";
import { truncateText } from "./text.ts";

/**
 * A property that returns the content that is rendered regardless of the {@link Message.type}. In
 * some cases, this just returns the regular {@link Message.content}. Otherwise this returns an
 * English message denoting the contents of the system message.
 *
 * @author Based Off of [Rapptz/discord.py’s
 *   `system_content`](https://github.com/Rapptz/discord.py/blob/7db879b/discord/message.py#L239-L2814)
 * @param message - Message to convert.
 * @param references - Whether to fetch references or show a reply line.
 * @returns Text representation of the message.
 */
export function messageToText(message: Message | MessageSnapshot, references: false): string;
export function messageToText(message: Message, references?: true): Awaitable<string>;
export function messageToText(
	message: Message | MessageSnapshot,
	references = true,
): Awaitable<string> {
	const loadingMessage =
		message.flags.has("Loading")
		&& ((Date.now() - message.createdTimestamp) / 1000 / 60 > 15 ?
			`${constants.emojis.message.error} The application did not respond`
		:	`${constants.emojis.message.loading} ${escapeAllMarkdown(
				message.author?.displayName ?? "The application",
				// eslint-disable-next-line unicorn/string-content
			)} is thinking...`);
	const snapshots = message.messageSnapshots
		?.map((snapshot) => {
			const text = messageToText(snapshot, false)
				.split("\n")
				.map((line) => (line.startsWith("> ") ? line : `> ${line}`))
				.join("\n");
			return `> *${constants.emojis.message.forward} Forwarded${text ? `\n${text}` : ""}`;
		})
		.join("\n\n");

	const content =
		loadingMessage
		|| (snapshots && message.content ?
			`${snapshots}\n\n${message.content}`
		:	snapshots || message.content);

	if (message.partial) return content;

	switch (message.type) {
		case MessageType.Default: {
			break;
		}
		case MessageType.RecipientAdd: {
			return `${constants.emojis.message.add} ${message.author.toString()} added ${
				message.mentions.users.first()?.toString() ?? "**Unknown User**"
			} to the ${message.channel.isThread() ? "thread" : "group"}.`;
		}
		case MessageType.RecipientRemove: {
			const ping = message.mentions.users.first();
			return `${constants.emojis.message.remove} ${message.author.toString()} ${
				ping ? `removed ${ping.toString()} from` : "left"
			} the ${message.channel.isThread() ? "thread" : "group"}.`;
		}
		case MessageType.Call: {
			if (!message.call)
				return `${constants.emojis.message.call} ${message.author.toString()} started a call.`;

			const participated = message.call.participants.includes(message.author.id);

			if (message.call.endedTimestamp) {
				const duration = formatDuration(
					message.call.endedTimestamp - message.createdTimestamp,
				);
				return participated ?
						`${message.author.toString()} started a call that lasted ${duration}.`
					:	`You missed a call from ${message.author.toString()} that lasted ${duration}.`;
			}
			return `${message.author.toString()} started a call.${participated ? "" : " — Join the call"}`;
		}
		case MessageType.ChannelNameChange: {
			return `${constants.emojis.message.edit} ${message.author.toString()} changed the ${
				message.channel.isThread() && message.channel.parent?.isThreadOnly() ?
					"post title"
				:	"channel name"
			}: **${escapeAllMarkdown(content)}**`;
		}
		case MessageType.ChannelIconChange: {
			return `${
				constants.emojis.message.edit
			} ${message.author.toString()} changed the group icon.`;
		}
		case MessageType.ChannelPinnedMessage: {
			if (!references)
				return `${
					constants.emojis.message.pin
				} ${message.author.toString()} pinned **a message** to this channel. See all **pinned messages**.`;

			return `${constants.emojis.message.pin} ${message.author.toString()} pinned ${
				message.reference?.messageId ?
					`[a message](<${messageLink(
						message.reference.guildId ?? message.guild?.id ?? "@me",
						message.reference.channelId,
						message.reference.messageId,
					)}>`
				:	"a message"
			}) to this channel. See all [pinned messages](<${message.channel.url}>).`;
		}
		case MessageType.UserJoin: {
			const formats =
				message.guild?.features.includes("CLAN") ?
					([
						`Everyone welcome ${message.author.toString()} to the Guild!`,
						`A new member has spawned. Say hi to ${message.author.toString()}.`,
						`${message.author.toString()} just joined the Guild. We hope you brought pizza.`,
						// eslint-disable-next-line unicorn/string-content
						`Glad you're here, ${message.author.toString()}, welcome to the Guild.`,
						`New recruit! ${message.author.toString()} joined the Guild.`,
						`Round of applause for the newest Guild member, ${message.author.toString()}. Just for being here.`,
						`Rolling out the red carpet for ${message.author.toString()}. Say hi!`,
						`Yahaha! ${message.author.toString()} found us!`,
						`Get ready everyone -- a ${message.author.toString()} has appeared!`,
						`Roses are red, violets are blue, ${message.author.toString()} just joined the Guild with you.`,
					] as const)
				:	([
						`${message.author.toString()} joined the party.`,
						`${message.author.toString()} is here.`,
						`Welcome, ${message.author.toString()}. We hope you brought pizza.`,
						`A wild ${message.author.toString()} appeared.`,
						`${message.author.toString()} just landed.`,
						`${message.author.toString()} just slid into the server.`,
						`${message.author.toString()} just showed up!`,
						`Welcome ${message.author.toString()}. Say hi!`,
						`${message.author.toString()} hopped into the server.`,
						`Everyone welcome ${message.author.toString()}!`,
						// eslint-disable-next-line unicorn/string-content
						`Glad you're here, ${message.author.toString()}.`,
						`Good to see you, ${message.author.toString()}.`,
						`Yay you made it, ${message.author.toString()}!`,
					] as const);

			return `${constants.emojis.message.add} ${
				formats[message.createdTimestamp % formats.length] ?? formats[0]
			}`;
		}
		case MessageType.GuildBoost: {
			return `${
				constants.emojis.message.boost
			} ${message.author.toString()} just boosted the server${
				content && ` **${escapeAllMarkdown(content)}** times`
			}!`;
		}
		case MessageType.GuildBoostTier1: {
			return `${
				constants.emojis.message.boost
			} ${message.author.toString()} just boosted the server${
				content && ` **${escapeAllMarkdown(content)}** times`
			}! ${escapeAllMarkdown(message.guild?.name ?? "")} has achieved **Level 1**!`;
		}
		case MessageType.GuildBoostTier2: {
			return `${
				constants.emojis.message.boost
			} ${message.author.toString()} just boosted the server${
				content && ` **${escapeAllMarkdown(content)}** times`
			}! ${escapeAllMarkdown(message.guild?.name ?? "")} has achieved **Level 2**!`;
		}
		case MessageType.GuildBoostTier3: {
			return `${
				constants.emojis.message.boost
			} ${message.author.toString()} just boosted the server${
				content && ` **${escapeAllMarkdown(content)}** times`
			}! ${escapeAllMarkdown(message.guild?.name ?? "")} has achieved **Level 3**!`;
		}
		case MessageType.ChannelFollowAdd: {
			return `${
				constants.emojis.message.add
			} ${message.author.toString()} has added **${escapeAllMarkdown(
				content,
			)}** to this channel. Its most important updates will show up here.`;
		}
		case MessageType.GuildDiscoveryDisqualified: {
			return `${
				constants.emojis.message.fail
			} This server has been removed from Server Discovery because it no longer passes all the requirements. Check [Server Settings](discord://-/guilds/${
				message.guild?.id ?? "@me"
			}/settings/discovery) for more details.`;
		}
		case MessageType.GuildDiscoveryRequalified: {
			return `${
				constants.emojis.message.success
			} This server is eligible for Server Discovery again and has been automatically relisted!`;
		}
		case MessageType.GuildDiscoveryGracePeriodInitialWarning: {
			return `${
				constants.emojis.message.warning
			} This server has failed Discovery activity requirements for 1 week. If this server fails for 4 weeks in a row, it will be automatically removed from Discovery.`;
		}
		case MessageType.GuildDiscoveryGracePeriodFinalWarning: {
			return `${
				constants.emojis.message.warning
			} This server has failed Discovery activity requirements for 3 weeks in a row. If this server fails for 1 more week, it will be removed from Discovery.`;
		}
		case MessageType.ThreadCreated: {
			return `${
				constants.emojis.message.thread
			} ${message.author.toString()} started a thread: [${escapeAllMarkdown(
				content,
			)}](<${channelLink(
				message.reference?.guildId ?? message.guild?.id ?? "@me",
				message.reference?.channelId ?? message.id,
			)}>) See all [threads](<${message.channel.url}>).`;
		}
		case MessageType.Reply: {
			if (!references) break;
			const replyLink = `<${messageLink(
				message.reference?.guildId ?? message.guild?.id ?? "@me",
				message.reference?.channelId ?? message.channel.id,
				message.reference?.messageId ?? message.id,
			)}>` as const;

			return message
				.fetchReference()
				.catch(() => void 0)
				.then((reply) => {
					if (!reply)
						return `*${
							constants.emojis.message.reply
						}[ Original message was deleted](${replyLink})*\n\n${content}`;

					const cleanContent = messageToText(reply, false).replaceAll(/\s+/g, " ");
					const replyContent =
						cleanContent && `\n> ${truncateText(stripMarkdown(cleanContent), 300)}`;
					return `*[Replying to ](${replyLink})${reply.author.toString()}${
						replyContent && `:`
					}*${replyContent}\n\n${content}`;
				});
		}
		case MessageType.ChatInputCommand: {
			if (!references || !message.interaction) break;

			const userPing = message.interaction.user.toString();
			return mentionChatCommand(
				message.interaction.commandName,
				message.guild ?? undefined,
			).then(
				(formatted) => `*${userPing} used ${formatted}${content ? `:*\n${content}` : "*"}`,
			);
		}
		case MessageType.ThreadStarterMessage: {
			const failMessage = `${
				constants.emojis.message.thread
				// eslint-disable-next-line unicorn/string-content
			} Sorry, we couldn't load the first message in this thread`;
			if (!message.reference) return failMessage;

			if (!references) break;

			return message
				.fetchReference()
				.catch(() => void 0)
				.then(async (reference) =>
					reference ?
						(await messageToText(reference, references)) || content
					:	failMessage,
				);
		}
		case MessageType.GuildInviteReminder: {
			return "Wondering who to invite?\nStart by inviting anyone who can help you build the server!";
		}
		case MessageType.ContextMenuCommand: {
			if (!references || !message.interaction) break;
			return `*${message.interaction.user.toString()} used **${escapeAllMarkdown(
				message.interaction.commandName,
			)}**${content ? `:*\n${content}` : "*"}`;
		}
		case MessageType.AutoModerationAction: {
			return `**AutoMod** 🤖 has ${
				message.embeds[0]?.fields.find(({ name }) => name === "flagged_message_id") ?
					"flagged"
				:	"blocked"
			} a message in ${channelMention(
				message.embeds[0]?.fields.find(({ name }) => name === "channel_id")?.value
					?? message.channel.id,
			)}`;
		}
		case MessageType.RoleSubscriptionPurchase: {
			if (!message.roleSubscriptionData) return "";

			const {
				totalMonthsSubscribed: months,
				isRenewal,
				tierName,
			} = message.roleSubscriptionData;
			return `${constants.emojis.message.add} ${message.author.toString()} ${
				isRenewal ? "renewed" : "joined"
			} **${escapeAllMarkdown(tierName)}** ${
				months ? "and has been" : "as"
			} a subscriber of ${hyperlink(
				escapeAllMarkdown(message.guild?.name ?? ""),
				`discord://-/channels/${message.guild?.id ?? "@me"}/role-subscriptions`,
			)}${months ? ` for ${months.toLocaleString()} month${months === 1 ? "" : "s"}!` : `!`}`;
		}
		case MessageType.InteractionPremiumUpsell: {
			break;
		}
		case MessageType.StageStart: {
			return `${
				constants.emojis.message.live
			} ${message.author.toString()} started **${escapeAllMarkdown(content)}**`;
		}
		case MessageType.StageEnd: {
			return `${
				constants.emojis.message.stage
			} ${message.author.toString()} ended **${escapeAllMarkdown(content)}**`;
		}
		case MessageType.StageSpeaker: {
			return `${
				constants.emojis.message.speaker
			} ${message.author.toString()} is now a speaker.`;
		}
		case MessageType.StageRaiseHand: {
			return `${
				constants.emojis.message.raisedHand
			} ${message.author.toString()} requested to speak.`;
		}
		case MessageType.StageTopic: {
			return `${
				constants.emojis.message.stage
			} ${message.author.toString()} changed the Stage topic: **${escapeAllMarkdown(content)}**`;
		}
		case MessageType.GuildApplicationPremiumSubscription: {
			return `${
				constants.emojis.message.subscription
			} ${message.author.toString()} upgraded ${
				message.groupActivityApplication?.name ?? `a deleted application`
			} to premium for this server! 🎉`;
		}
		case MessageType.GuildIncidentAlertModeEnabled: {
			const date = new Date(message.content);
			return `${message.author.toString()} enabled security actions until ${time(
				date,
				TimestampStyles.ShortDate,
			)}, ${time(date, TimestampStyles.ShortTime)}.`;
		}
		case MessageType.GuildIncidentAlertModeDisabled: {
			return `${message.author.toString()} disabled security actions.`;
		}
		case MessageType.GuildIncidentReportRaid: {
			return `${message.author.toString()} reported a raid in ${escapeAllMarkdown(
				message.guild?.name ?? "",
			)}.`;
		}
		case MessageType.GuildIncidentReportFalseAlarm: {
			return `${message.author.toString()} resolved an Activity Alert.`;
		}
		case MessageType.PurchaseNotification: {
			// todo does djs even define this
			const purchaseNotification =
				"purchaseNotification" in message ?
					(message.purchaseNotification as {
						type: 0;
						guildProductPurchase?: { listingId: Snowflake; productName: string };
					})
				:	undefined;
			return `${message.author.toString()} has purchased [${
				purchaseNotification?.guildProductPurchase?.productName ?? ""
			}](<https://discord.com/channels/${message.channel.id}/shop/${
				purchaseNotification?.guildProductPurchase?.listingId ?? ""
			}>)!`;
		}
		case MessageType.PollResult: {
			// eslint-disable-next-line unicorn/string-content
			return `${constants.emojis.message.poll} ${message.author.toString()}'s poll [${
				indexEmbedFields(message.embeds[0] ?? {}, { poll_question_text: "" })
					.poll_question_text
			}](<${messageLink(
				message.reference?.guildId ?? message.guild?.id ?? "@me",
				message.reference?.channelId ?? message.channel.id,
				message.reference?.messageId ?? message.id,
			)}>) has closed.`;
		}
	}

	return content;
}

function indexEmbedFields<
	T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(
	embed: APIEmbed | Embed,
	defaults: T,
): { [key in keyof T]: T[key] | string } & Record<string, string | undefined>;
function indexEmbedFields(
	embed: APIEmbed | Embed,
	defaults?: undefined,
): Record<string, string | undefined>;
function indexEmbedFields(
	embed: APIEmbed | Embed,
	defaults: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
	return (embed.fields ?? []).reduce(
		(accumulator, field) => ({ ...accumulator, [field.name]: field.value }),
		defaults,
	);
}

export const GlobalBotInvitesPattern = new RegExp(
	/discord(?:app)?\.com\/(?:(?:api\/)?oauth2\/authorize\/?\?\S*client_id=(?!CLIENT_ID)\d{17,20}\S*(?:\s|$)|application-directory\/(?!CLIENT_ID)\d{17,20})/.source.replaceAll(
		"CLIENT_ID",
		constants.env === "testing" ? "0" : client.user.id,
	),
	"gi",
);

export function assertSendable<T extends Channel>(channel: T): (T & SendableChannels) | undefined {
	if (!channel.isSendable()) return;
	if (channel.isDMBased()) return channel;

	if (channel.isThread()) {
		if (!channel.sendable) return;
		return channel;
	}

	const permissions = channel.permissionsFor(client.user);
	if (!permissions) return;

	if (permissions.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages))
		return channel;
}

export async function tryReact(
	message: Message,
	emoji: EmojiIdentifierResolvable,
): Promise<MessageReaction | undefined> {
	const { channel } = message;
	if (channel.isDMBased()) return;
	const permissions = channel.permissionsFor(client.user);
	if (!permissions?.has(PermissionFlagsBits.AddReactions)) return;
	try {
		return await message.react(emoji);
	} catch (error) {
		if (
			error instanceof DiscordAPIError
			&& error.code === RESTJSONErrorCodes.ReactionWasBlocked
		)
			return;
		throw error;
	}
}
