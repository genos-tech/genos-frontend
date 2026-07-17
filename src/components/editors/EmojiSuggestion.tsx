import { DefaultReactSuggestionItem } from "@blocknote/react";
import emojiData from "@emoji-mart/data";
import { Box } from "@mui/joy";
import { init, SearchIndex } from "emoji-mart";

import { getMessages } from "../../i18n";
import { getTeamEmojiSnapshot } from "../../services/teamEmojiStore";
import { CustomEmojiImg } from "./CustomEmoji";

// Initialize emoji-mart's SearchIndex once at module load. The Promise is
// intentionally not awaited; subsequent search() calls will start working as
// soon as the data is registered (typically before the user can type a query).
init({ data: emojiData });

const MAX_RESULTS = 12;

type EmojiMartResult = {
    id: string;
    name?: string;
    keywords?: string[];
    skins?: { native: string }[];
};

const buildEmojiItem = (
    editor: any,
    emoji: EmojiMartResult
): DefaultReactSuggestionItem | null => {
    const native = emoji.skins?.[0]?.native;
    if (!native) {
        return null;
    }

    return {
        title: emoji.name ?? emoji.id,
        subtext: `:${emoji.id}:`,
        aliases: emoji.keywords,
        group: getMessages().common.editor.emojiGroup,
        onItemClick: () => {
            editor.insertInlineContent([{ type: "text", text: native, styles: {} }]);
        },
        icon: (
            <Box
                alignItems="center"
                display="flex"
                fontSize={20}
                height={28}
                justifyContent="center"
                width={28}
            >
                {native}
            </Box>
        ),
    };
};

// Team custom emoji matched from the module-level catalog (NOT from
// SearchIndex: the picker merges customs into emoji-mart's global data
// on mount, but only after a picker has opened — the store is the
// authoritative source at all times). Listed ahead of unicode results,
// Slack-style.
const buildCustomEmojiItems = (editor: any, query: string): DefaultReactSuggestionItem[] => {
    const q = query.toLowerCase();
    return getTeamEmojiSnapshot()
        .filter((e) => e.name.includes(q))
        .slice(0, MAX_RESULTS)
        .map((e) => ({
            title: e.name,
            subtext: `:${e.name}:`,
            group: getMessages().common.editor.emojiGroup,
            onItemClick: () => {
                editor.insertInlineContent([
                    { type: "customEmoji", props: { name: e.name, url: e.url } },
                    " ",
                ]);
            },
            icon: (
                <Box
                    alignItems="center"
                    display="flex"
                    height={28}
                    justifyContent="center"
                    width={28}
                >
                    <CustomEmojiImg name={e.name} size={20} url={e.url} />
                </Box>
            ),
        }));
};

// Returns suggestion items for BlockNote's `:`-triggered menu. Team
// custom emoji (catalog prefix/substring match) come first, then the
// query goes to emoji-mart's SearchIndex, which handles fuzzy matching
// against names, keywords, and shortcodes. Combined cap stays at
// MAX_RESULTS so the menu doesn't grow.
export const getEmojiSuggestionItems = async (
    editor: any,
    query: string
): Promise<DefaultReactSuggestionItem[]> => {
    if (!query) {
        return [];
    }

    const customItems = buildCustomEmojiItems(editor, query);

    const results = ((await SearchIndex.search(query, {
        maxResults: MAX_RESULTS,
        caller: undefined,
    })) ?? []) as EmojiMartResult[];

    const unicodeItems = results
        .map((emoji) => buildEmojiItem(editor, emoji))
        .filter((item): item is DefaultReactSuggestionItem => item !== null);

    return [...customItems, ...unicodeItems].slice(0, MAX_RESULTS);
};
