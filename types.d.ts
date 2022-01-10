import type { MessageEmbed } from 'discord.js';

export type Game = {
	name: string,
	match?: RegExp,
	validWordsOnly?: boolean,
	twiceInRow?: boolean,
	duplicates?: boolean,
	manualCheck?:(current:string, last?:MessageDatabaseItem)=> MessageEmbed|true,
}

export type MessageDatabaseItem ={
word: string,
author: string,
id: string,
index: number,
guild: string,
}
