import { useMemo } from "react";

import { TabStrip, type TabItem } from "../../../../components/ui/feedback/TabStrip";
import { useTranslation } from "../../../../i18n";
import { originOfNote } from "../utils/noteTypeAlias";
import { NoteOriginIcon } from "./noteOrigin";

type NoteTabLike = {
    noteType: number;
    noteId: number | string;
    title: string;
    // For a personal note: which space it was opened from (my / shared / team).
    bucket?: "my" | "shared" | "team";
};

type NoteTabStripProps = {
    tabs: NoteTabLike[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onCloseTab: (index: number, noteId: number) => void | Promise<void>;
};

/** One id per tab, even if the same note shows up twice in the list (a race
 *  while opening): the second gets a suffix, so keys and lookups stay unique. */
const tabIds = (tabs: NoteTabLike[]): string[] => {
    const seen = new Map<string, number>();
    return tabs.map((tab) => {
        const base = `${tab.noteType}-${tab.noteId}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return n === 1 ? base : `${base}#${n}`;
    });
};

/**
 * The open-notes tab strip (MIP-1132). `NoteTabList`, `ChatNoteTabList` and
 * `TaskNoteTabs` were 330-line copies that differed only in their props;
 * this is the one, on the shared `TabStrip`. Sideways scrolling and keeping
 * the selected tab in view come from `TabStrip`.
 */
export const NoteTabStrip = ({ tabs, selectedIndex, onSelect, onCloseTab }: NoteTabStripProps) => {
    const { t } = useTranslation();
    const ids = useMemo(() => tabIds(tabs), [tabs]);
    const items = useMemo<TabItem[]>(
        () =>
            tabs.map((tab, i) => ({
                id: ids[i],
                label: tab.title,
                title: tab.title,
                // The family the note came from, as everywhere else it is listed (MIP-1429).
                icon: <NoteOriginIcon noteType={originOfNote(tab.noteType, tab.bucket)} />,
                closable: true,
            })),
        [tabs, ids]
    );

    return (
        <TabStrip
            ariaLabel={t.notes.tabs.ariaLabel}
            closeLabel={t.notes.tabs.closeTab}
            maxLabelWidth={140}
            tabs={items}
            value={ids[selectedIndex] ?? ""}
            onChange={(id) => {
                const index = ids.indexOf(id);
                if (index >= 0) onSelect(index);
            }}
            onClose={(id) => {
                const index = ids.indexOf(id);
                if (index >= 0) void onCloseTab(index, Number(tabs[index].noteId));
            }}
        />
    );
};
