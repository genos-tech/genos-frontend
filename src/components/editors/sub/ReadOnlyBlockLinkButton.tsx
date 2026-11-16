import { RefObject, useEffect, useRef, useState } from "react";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { IconButton } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { focusRing } from "../../../theme/tokens";
import { AppTooltip } from "../../ui/AppTooltip";
import { useNoteLink } from "./NoteLinkContext";

// Where the button sits, left of the block's text, inside the editor box.
const GUTTER = 30;
// How long the button stays once the pointer has left: long enough to cross to it.
const HIDE_MS = 150;
const BLOCK = '[data-node-type="blockContainer"][data-id]';
const MARK = "data-block-link-button";

type At = { id: string; top: number; left: number };

/**
 * "Copy link to block" for someone who cannot edit the note (MIP-1650).
 *
 * An editor gets the link from the block's drag-handle menu (MIP-146), but BlockNote shows that side
 * menu only while the editor is editable, so a viewer, who can open a note and comment on it, had
 * no way to link to a block. This is a button of its own: it follows the pointer from block to
 * block and does ONE thing, copy the link. It has no drag, no delete and no colours, and it never
 * writes to the document, so it is safe where the side menu is not.
 *
 * It listens on the editor box rather than inside BlockNote, so it needs nothing from the editor,
 * and it finds the block under the pointer the way BlockNote marks it (`data-id` on the block's
 * container). Offered only inside a note that has a page of its own (`useNoteLink()` is null
 * elsewhere), as the drag-handle item is. Hover only: a touch screen has no hover, and the button
 * is not reachable by keyboard; a viewer there still has the comment links.
 */
export const ReadOnlyBlockLinkButton = ({ boxRef }: { boxRef: RefObject<HTMLElement | null> }) => {
    const noteLink = useNoteLink();
    const { t } = useTranslation();
    const [at, setAt] = useState<At | null>(null);
    const hideTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        const box = boxRef.current;
        if (!box || !noteLink) return;
        const cancelHide = () => window.clearTimeout(hideTimer.current);
        const hideSoon = () => {
            cancelHide();
            hideTimer.current = window.setTimeout(() => setAt(null), HIDE_MS);
        };
        const hideNow = () => {
            cancelHide();
            setAt(null);
        };
        const onMove = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            // On the button itself: keep it where it is.
            if (target.closest(`[${MARK}]`)) return cancelHide();
            const block = target.closest(BLOCK);
            const id = block?.getAttribute("data-id");
            if (!block || !id || !box.contains(block)) return hideSoon();
            cancelHide();
            const b = block.getBoundingClientRect();
            const c = box.getBoundingClientRect();
            const next = {
                id,
                top: Math.round(b.top - c.top),
                left: Math.max(Math.round(b.left - c.left) - GUTTER, 2),
            };
            setAt((prev) =>
                prev && prev.id === id && prev.top === next.top && prev.left === next.left
                    ? prev
                    : next
            );
        };
        box.addEventListener("mousemove", onMove);
        box.addEventListener("mouseleave", hideSoon);
        // A scroll inside the box moves the blocks under a button that stays put.
        box.addEventListener("scroll", hideNow, true);
        return () => {
            box.removeEventListener("mousemove", onMove);
            box.removeEventListener("mouseleave", hideSoon);
            box.removeEventListener("scroll", hideNow, true);
            cancelHide();
        };
    }, [boxRef, noteLink]);

    if (!noteLink || !at) return null;
    const label = t.common.editor.noteLink.copyBlockLink;
    return (
        <AppTooltip title={label}>
            <IconButton
                {...{ [MARK]: "" }}
                aria-label={label}
                color="neutral"
                data-testid="read-only-block-link"
                size="sm"
                variant="plain"
                sx={{
                    position: "absolute",
                    top: at.top,
                    left: at.left,
                    zIndex: 2,
                    "--IconButton-size": "24px",
                    opacity: 0.75,
                    "&:hover, &:focus-visible": { opacity: 1 },
                    "&:focus-visible": focusRing,
                }}
                onClick={() => {
                    const url = noteLink.blockLink(at.id);
                    if (url) void noteLink.copy(url);
                }}
            >
                <LinkRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
        </AppTooltip>
    );
};
