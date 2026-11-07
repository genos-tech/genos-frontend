import { ReactNode } from "react";
import { Box, Button, Typography } from "@mui/joy";

import { focusRing, g } from "../../../theme/tokens";

/**
 * The one empty state (MIP-1132). Four components used to share this name
 * (notes, To-Do, chat list, history) and ~67 screens wrote their own "No X"
 * line, in three designs. This is the design `/workspace/design` shows:
 * a neutral icon in a quiet disc, one line of title, one line of direction
 * and at most one action.
 *
 * Copy rules (genos-ui): the TITLE says what is empty ("No notes yet"), the
 * BODY says what to do next ("Create one to start writing."), never a
 * shrug ("Nothing here.") and never an apology. Pass the strings in; they
 * must come from the locale files.
 *
 * `size="sm"` is for narrow places (a popover, a sidebar section, a tab
 * panel): smaller disc and type, tighter padding, same structure. `fill`
 * centers the block in the parent's full height, for a pane that is empty
 * as a whole.
 */

type EmptyStateAction = {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
};

export type EmptyStateProps = {
    title: string;
    /** What to do next. Omit only when the title already says it. */
    body?: string;
    icon?: ReactNode;
    action?: EmptyStateAction;
    size?: "md" | "sm";
    /** Center in the parent's full height instead of sitting at the top. */
    fill?: boolean;
    /** Marker for tests and analytics, e.g. "chat-list". */
    "data-empty"?: string;
};

export const EmptyState = ({
    title,
    body,
    icon,
    action,
    size = "md",
    fill = false,
    "data-empty": dataEmpty,
}: EmptyStateProps) => {
    const small = size === "sm";
    return (
        <Box
            data-empty={dataEmpty}
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: fill ? "center" : "flex-start",
                textAlign: "center",
                gap: small ? 0.5 : 1,
                py: small ? 2 : 4,
                px: 2,
                minWidth: 0,
                ...(fill ? { height: "100%", width: "100%" } : null),
            }}
        >
            {icon && (
                <Box
                    sx={{
                        width: small ? 32 : 40,
                        height: small ? 32 : 40,
                        borderRadius: g.radius.full,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: g.bg.subtle,
                        boxShadow: `inset 0 0 0 1px ${g.border.subtle}`,
                        color: g.text.tertiary,
                        "--Icon-color": g.text.tertiary,
                        mb: 0.5,
                        "& svg": { fontSize: small ? 16 : 20 },
                    }}
                    aria-hidden
                >
                    {icon}
                </Box>
            )}
            <Typography
                level={small ? "title-sm" : "title-md"}
                sx={{ color: g.text.primary, overflowWrap: "anywhere" }}
            >
                {title}
            </Typography>
            {body && (
                <Typography
                    level="body-sm"
                    sx={{ color: g.text.secondary, maxWidth: 280, overflowWrap: "anywhere" }}
                >
                    {body}
                </Typography>
            )}
            {action && (
                <Box sx={{ mt: 1 }}>
                    <Button
                        color="neutral"
                        size="sm"
                        startDecorator={action.icon}
                        variant="outlined"
                        sx={{
                            "&:focus-visible": focusRing,
                        }}
                        onClick={action.onClick}
                    >
                        {action.label}
                    </Button>
                </Box>
            )}
        </Box>
    );
};
