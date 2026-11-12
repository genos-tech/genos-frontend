import { ReactNode } from "react";
import { Box, List, ListItem } from "@mui/joy";

import { navNestedListSx } from "../../../../components/ui/nav/navStyles";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { useSidebarOpen } from "../../../tasks/components/sidebar/useSidebarOpen";

interface NotePinnedSectionProps {
    /** Remembers whether the person folded it (Favorites, Recents, Unread). */
    id: string;
    title: string;
    children: ReactNode;
    count?: number;
    defaultOpen?: boolean;
}

/**
 * A section pinned above the workspaces: Favorites, Recents, Unread (MIP-1429).
 *
 * A heading with its rows under it, the way the Tasks sidebar draws "Views" and "Projects":
 * quiet, with a count, and it folds. It is NOT a place to be: it used to be a row in the same
 * list as My Notes and wear the selected tint, so with nothing open "Recents" looked like the
 * current page. A click only folds it.
 */
export function NotePinnedSection({
    id,
    title,
    children,
    count,
    defaultOpen = true,
}: NotePinnedSectionProps) {
    const [open, setOpen] = useSidebarOpen(`notes.${id}`, defaultOpen);

    return (
        <ListItem sx={{ mt: 0.5, p: 0 }} nested>
            <SectionHeader
                as="div"
                count={count}
                expanded={open}
                label={title}
                onToggleExpanded={() => setOpen((prev) => !prev)}
            />
            <Box
                sx={{
                    display: "grid",
                    transition: "grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    "& > *": { overflow: "hidden" },
                }}
            >
                <List sx={navNestedListSx}>{children}</List>
            </Box>
        </ListItem>
    );
}
