/**
 * Personal (per-user, PRIVATE) tags on GM chats.
 *
 * Gmail-label model: the tags a user attaches to a GM are visible only
 * to that user — they are served by the dedicated
 * `/api/v3/personal-tags/` endpoints and deliberately NEVER ride the
 * channel payload (`ChannelSerializer` is broadcast to whole channel
 * rooms by the sockets proxy, so per-user data there would leak across
 * members). See `usePersonalGMTags` for the store.
 */

export interface PersonalTag {
    tagId: number;
    name: string;
    color: string;
    textColor: string;
    /** "Pinned to the sidebar filter row" — the user's explicit
     *  customization. When >=1 tag is pinned the chip row shows exactly
     *  the pinned set; otherwise a recency-derived default. */
    isDefaultVisible: boolean;
    sortOrder: number;
}

export interface PersonalTagsBundle {
    tags: PersonalTag[];
    /** channelId (v3 UUID, === `AllChatProps.chatId`) → tagIds. Only
     *  channels with an active membership are included. */
    assignments: Record<string, number[]>;
    /** Server-computed default chip set: pinned ids when the user has
     *  customized, else tags of GMs they recently sent messages in. */
    defaultVisibleTagIds: number[];
}
