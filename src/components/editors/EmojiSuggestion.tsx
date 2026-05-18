import { DefaultReactSuggestionItem } from "@blocknote/react";
import emojiData from "@emoji-mart/data";
import { Box } from "@mui/joy";
import { init, SearchIndex } from "emoji-mart";

import { getMessages } from "../../i18n";

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

// Returns suggestion items for BlockNote's `:`-triggered menu. The query is
// passed straight to emoji-mart's SearchIndex, which handles fuzzy matching
// against names, keywords, and shortcodes.
export const getEmojiSuggestionItems = async (
    editor: any,
    query: string
): Promise<DefaultReactSuggestionItem[]> => {
    if (!query) {
        return [];
    }

    const results = ((await SearchIndex.search(query, {
        maxResults: MAX_RESULTS,
        caller: undefined,
    })) ?? []) as EmojiMartResult[];

    return results
        .map((emoji) => buildEmojiItem(editor, emoji))
        .filter((item): item is DefaultReactSuggestionItem => item !== null);
};
