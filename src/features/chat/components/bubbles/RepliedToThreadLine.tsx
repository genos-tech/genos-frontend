import type React from "react";
import { Box } from "@mui/joy";

import { PlainButton } from "../../../../components/ui/PlainButton";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";

type RepliedToThreadLineProps = {
    /** The thread root's first line, or null when there is none to show. */
    preview: string | null;
    onOpen: (e: React.MouseEvent) => void;
};

// Where the preview goes in the translated sentence: a mark no translation contains.
const PREVIEW_SLOT = "\u0000";

/**
 * The line above a main-chat message that is really a thread reply also sent to the chat
 * (MIP-2486): "Replied to a thread: <first line of the thread>", a button that opens it.
 * Clicks stop here, so they do not also select the message or add it to the to-do list.
 */
export const RepliedToThreadLine = ({ preview, onOpen }: RepliedToThreadLineProps) => {
    const { t } = useTranslation();
    // The preview is someone's own text, in any direction: it is isolated in its own `bdi`.
    const [before, after] = preview
        ? fmt(t.chat.bubble.repliedToThreadWithPreview, { preview: PREVIEW_SLOT }).split(
              PREVIEW_SLOT
          )
        : [t.chat.bubble.repliedToThread, ""];
    return (
        <PlainButton
            title={preview ?? undefined}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                onOpen(e);
            }}
            sx={{
                ...type("caption"),
                display: "block",
                // Adds nothing to a balloon's width: the message decides it, and a long
                // preview is cut inside it.
                contain: "inline-size",
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "start",
                marginBottom: "2px",
                color: g.text.tertiary,
                "&:hover": { textDecoration: "underline", color: g.accent.text },
                // WCAG's smallest finger target, on a touch screen only.
                "@media (pointer: coarse)": { minHeight: 28 },
            }}
        >
            {before}
            {preview && (
                <Box component="bdi" sx={{ font: "inherit" }}>
                    {preview}
                </Box>
            )}
            {after}
        </PlainButton>
    );
};
