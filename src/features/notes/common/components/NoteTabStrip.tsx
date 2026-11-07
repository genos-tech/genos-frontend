import { useMemo } from "react";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import { TabStrip, type TabItem } from "../../../../components/ui/feedback/TabStrip";
import { useTranslation } from "../../../../i18n";

type NoteTabLike = { noteType: number; noteId: number | string; title: string };

type NoteTabStripProps = {
    tabs: NoteTabLike[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onCloseTab: (index: number, noteId: number) => void | Promise<void>;
};

const tabId = (tab: NoteTabLike) => `${tab.noteType}-${tab.noteId}`;

/**
 * The open-notes tab strip (MIP-1132). `NoteTabList`, `ChatNoteTabList` and
 * `TaskNoteTabs` were 330-line copies that differed only in their props;
 * this is the one, on the shared `TabStrip`. Sideways scrolling and keeping
 * the selected tab in view come from `TabStrip`.
 */
export const NoteTabStrip = ({ tabs, selectedIndex, onSelect, onCloseTab }: NoteTabStripProps) => {
    const { t } = useTranslation();
    const items = useMemo<TabItem[]>(
        () =>
            tabs.map((tab) => ({
                id: tabId(tab),
                label: tab.title,
                title: tab.title,
                icon: <DescriptionOutlinedIcon />,
                closable: true,
            })),
        [tabs]
    );
    const selected = tabs[selectedIndex];

    return (
        <TabStrip
            ariaLabel={t.notes.tabs.ariaLabel}
            closeLabel={t.notes.tabs.closeTab}
            maxLabelWidth={140}
            tabs={items}
            value={selected ? tabId(selected) : ""}
            onChange={(id) => {
                const index = tabs.findIndex((tab) => tabId(tab) === id);
                if (index >= 0) onSelect(index);
            }}
            onClose={(id) => {
                const index = tabs.findIndex((tab) => tabId(tab) === id);
                if (index >= 0) void onCloseTab(index, Number(tabs[index].noteId));
            }}
        />
    );
};
