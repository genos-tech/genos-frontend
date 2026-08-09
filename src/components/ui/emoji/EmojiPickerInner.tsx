import { useMemo, useSyncExternalStore } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

import { useTranslation } from "../../../i18n";
import { getTeamEmojiSnapshot, subscribeTeamEmoji } from "../../../services/teamEmojiStore";

// Thin wrapper that pairs the emoji-mart data set with the picker
// component. Kept in its own module so that the parent EmojiPicker can
// `React.lazy(() => import("./EmojiPickerInner"))` and pull both
// dependencies (~80 kB gzipped combined) on demand rather than shipping
// them in the main app bundle. Without this split they ended up in the
// startup chunk because every chat / task surface that *could* show the
// picker eagerly imported the picker component.

type Props = {
    theme: "light" | "dark";
    // For a custom (team) emoji, emoji-mart supplies `id` + `src` and
    // NO `native` — EmojiPicker's flattener turns that into ":id:".
    onEmojiSelect: (emoji: { native?: string; id?: string; src?: string }) => void;
    // Composers want the "Team Emoji" category; the user-status pickers
    // opt out (customStatus is a plain string rendered in places that
    // can't resolve shortcodes).
    includeCustom?: boolean;
};

export const EmojiPickerInner = ({ theme, onEmojiSelect, includeCustom = true }: Props) => {
    const teamEmoji = useSyncExternalStore(subscribeTeamEmoji, getTeamEmojiSnapshot);
    const { t } = useTranslation();

    // emoji-mart 5.x custom-category shape. The Picker re-runs its init
    // on every mount and re-merges this array, so a picker opened after
    // an upload shows the new emoji without any manual invalidation.
    const custom = useMemo(() => {
        if (!includeCustom || teamEmoji.length === 0) return undefined;
        return [
            {
                id: "team",
                name: t.common.editor.teamEmojiGroup,
                emojis: teamEmoji.map((e) => ({
                    id: e.name,
                    name: e.name,
                    keywords: e.name.split(/[_+-]+/).filter(Boolean),
                    skins: [{ src: e.url }],
                })),
            },
        ];
    }, [includeCustom, t.common.editor.teamEmojiGroup, teamEmoji]);

    return <Picker custom={custom} data={data} theme={theme} onEmojiSelect={onEmojiSelect} />;
};

export default EmojiPickerInner;
