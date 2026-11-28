import type React from "react";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
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
 * It reads as a link at rest (thread icon and accent colour): a phone has no hover.
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
            sx={{
                ...type("caption"),
                display: "flex",
                alignItems: "center",
                gap: "4px",
                // Adds nothing to a balloon's width: the message decides it, and a long
                // preview is cut inside it.
                contain: "inline-size",
                width: "100%",
                textAlign: "start",
                marginBottom: "2px",
                // `accent.text`, not the chat's link role: in dark that one is nearly white
                // and would not read as clickable. The icon follows the text (Joy greys it).
                color: g.accent.text,
                "--Icon-color": "currentColor",
                "&:hover": { textDecoration: "underline" },
                // WCAG's smallest finger target, on a touch screen only.
                "@media (pointer: coarse)": { minHeight: 28 },
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                onOpen(e);
            }}
        >
            {/* The icon of the thread pane's "Thread" chip. */}
            <ReplyRoundedIcon sx={{ fontSize: "1.2em", flexShrink: 0 }} aria-hidden />
            <Box
                component="span"
                sx={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {before}
                {preview && (
                    <Box component="bdi" sx={{ font: "inherit" }}>
                        {preview}
                    </Box>
                )}
                {after}
            </Box>
        </PlainButton>
    );
};
