// A small "Ask Genos" button next to text selected inside one chat message (MIP-1058, genos-api
// AGENT_PARITY_TOOLS). One per message list (main pane, thread pane), mounted by `MessageListRenderer`.
//
// What it must NOT do, and how:
//   - Break selecting, copying or following links. It never calls `preventDefault` on anything but its
//     own `mousedown` (which keeps the selection alive while the button is pressed), listens to nothing
//     but the list's own `mouseup` / `keyup` (not every `selectionchange` in the app), and sits outside
//     the message DOM (a portal), so it is never part of a selection.
//   - Fight a double-click (the app's "add to To-Do") or a triple click: a selection made by a click
//     count above one is not offered.
//   - Fight a phone. On a touch screen the browser's own selection handles and callout sit exactly
//     where this button would, and a long press already opens the message toolbar; there the way to
//     Ask is the message's "…" menu. So nothing is shown when the primary pointer is coarse.
//   - Leave a keyboard user out. A message body is not focusable, so the keyboard (and screen-reader)
//     route is the message's "…" menu, whose item turns into "Ask Genos about the selected text"
//     when a selection is in that message (`useAskGenosMessageItem`).
//   - Listen without need. The document-level `selectionchange` (to hide the button when the
//     selection goes away) is attached only while the button is showing.
//
// Right-to-left: it is centred on the selection, so it needs no side. Its text is the UI's.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { Button } from "@mui/joy";
import { createPortal } from "react-dom";

import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { makeAskSelection } from "../../../agentQA/askSelection";
import {
    askGenosSourceForMessage,
    requestAskGenosAboutSelection,
} from "../../../spotlight/askGenosAbout";
import { useAskGenosAvailable } from "../../../spotlight/useAskGenosAvailable";
import { readMessageSelection } from "../../utils/messageSelection";

// Above the page (the "…" menus sit at 9999 only when open), below every modal: an image preview
// or dialog opened over the list covers it, and Spotlight (13100) is far above.
const POPOVER_Z_INDEX = 1250;
// The gap between the selection and the button, and the room it needs above it (button height + gap).
const GAP = 8;
const NEEDED_ABOVE = 48;
// Half the button's width, so a selection near an edge keeps it on screen.
const EDGE = 84;

interface Anchor {
    messageId: string;
    text: string;
    top: number;
    bottom: number;
    centre: number;
}

const prefersTouch = (): boolean =>
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;

export const ChatSelectionAsk = ({
    containerRef,
}: {
    /** The list's own element: only a selection inside it is offered. */
    containerRef: RefObject<HTMLElement | null>;
}) => {
    const { t } = useTranslation();
    // Not in a chat previewed inside a link modal (see `useAskGenosAvailable`): it would sit under
    // the modal, and Spotlight could not take focus over it.
    const available = useAskGenosAvailable();
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    // The last click's count: a double or triple click selects a word or a paragraph on its way to
    // something else (a double-click adds the message to the To-Do list).
    const multiClickRef = useRef(false);

    const evaluate = useCallback(() => {
        const container = containerRef.current;
        if (!container || prefersTouch() || multiClickRef.current) {
            setAnchor(null);
            return;
        }
        const found = readMessageSelection();
        if (!found || !container.contains(found.body)) {
            setAnchor(null);
            return;
        }
        const { rect } = found;
        setAnchor({
            messageId: found.messageId,
            text: found.text,
            top: rect.top,
            bottom: rect.bottom,
            centre: rect.left + rect.width / 2,
        });
    }, [containerRef]);

    // The list's own pointer and key events: a selection is finished on mouse-up (or on a shift-arrow
    // key-up). One tick later, because the browser settles the selection after the event.
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !available) return;
        let timer: number | null = null;
        const schedule = () => {
            if (timer !== null) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                timer = null;
                evaluate();
            }, 0);
        };
        // A new press starts a new selection (or a click): the old button goes at once, so it never
        // trails a drag.
        const onMouseDown = () => setAnchor(null);
        const onMouseUp = (e: MouseEvent) => {
            multiClickRef.current = e.detail > 1;
            schedule();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            multiClickRef.current = false;
            if (e.key === "Shift" || e.key.startsWith("Arrow")) schedule();
        };
        container.addEventListener("mousedown", onMouseDown);
        container.addEventListener("mouseup", onMouseUp);
        container.addEventListener("keyup", onKeyUp);
        return () => {
            container.removeEventListener("mousedown", onMouseDown);
            container.removeEventListener("mouseup", onMouseUp);
            container.removeEventListener("keyup", onKeyUp);
            if (timer !== null) window.clearTimeout(timer);
        };
    }, [containerRef, evaluate, available]);

    // While the button shows: hide it when the selection goes (a click elsewhere), when the list
    // scrolls or the window resizes (its place is stale), and on Escape.
    const visible = anchor !== null;
    useEffect(() => {
        if (!visible) return;
        const hide = () => setAnchor(null);
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") hide();
        };
        document.addEventListener("selectionchange", evaluate);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", hide);
        const container = containerRef.current;
        // Capture: the list's scroller is a descendant and `scroll` does not bubble.
        container?.addEventListener("scroll", hide, true);
        return () => {
            document.removeEventListener("selectionchange", evaluate);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", hide);
            container?.removeEventListener("scroll", hide, true);
        };
    }, [visible, evaluate, containerRef]);

    if (!anchor) return null;

    const above = anchor.top >= NEEDED_ABOVE;
    const left = Math.min(Math.max(anchor.centre, EDGE), window.innerWidth - EDGE);

    const ask = () => {
        const selection = makeAskSelection(
            anchor.text,
            askGenosSourceForMessage(anchor.messageId)
        );
        if (selection) requestAskGenosAboutSelection(selection);
        window.getSelection()?.removeAllRanges();
        setAnchor(null);
    };

    return createPortal(
        <Button
            aria-label={t.chat.messageActions.askGenosSelection}
            color="neutral"
            data-testid="chat-selection-ask"
            size="sm"
            startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
                position: "fixed",
                top: above ? anchor.top - GAP : anchor.bottom + GAP,
                left,
                transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                zIndex: POPOVER_Z_INDEX,
                background: g.surface.raised,
                borderRadius: g.radius.md,
                boxShadow: g.shadow.md,
                whiteSpace: "nowrap",
            }}
            type="button"
            variant="outlined"
            // Keep the selection: a press on a button would otherwise collapse it before the click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={ask}
        >
            {t.chat.messageActions.askGenosShort}
        </Button>,
        document.body
    );
};
