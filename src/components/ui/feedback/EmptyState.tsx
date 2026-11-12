import { ReactNode } from "react";
import { Box, Button, Link, Typography } from "@mui/joy";

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
    /** `xs` only: a link at the end of the line ("No notes yet. New note") instead of a
     *  button on a line of its own, for a dense list whose empty state should cost one row. */
    inline?: boolean;
};

export type EmptyStateProps = {
    /**
     * What is empty. Omit it only for a one-sentence hint that already names
     * the thing and the next step ("No tags yet. Add one below."): the
     * sentence is then shown as the quiet direction line, not as a heading.
     */
    title?: string;
    /** What to do next. Omit only when the title already says it. */
    body?: string;
    icon?: ReactNode;
    action?: EmptyStateAction;
    /**
     * `xs` is one quiet line for a dense list (a sidebar section, a settings
     * list): start-aligned, small type, no icon, no title.
     */
    size?: "md" | "sm" | "xs";
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
    if (size === "xs") {
        const inline = action?.inline === true;
        return (
            <Box
                data-empty={dataEmpty}
                sx={{
                    py: 0.5,
                    minWidth: 0,
                    ...(inline && {
                        alignItems: "baseline",
                        columnGap: 0.75,
                        display: "flex",
                        flexWrap: "wrap",
                    }),
                }}
            >
                <Typography
                    level="body-xs"
                    sx={{ color: g.text.tertiary, overflowWrap: "anywhere" }}
                >
                    {body ?? title}
                </Typography>
                {action && inline && (
                    <Link
                        component="button"
                        level="body-xs"
                        sx={{ color: g.accent.text, "&:focus-visible": focusRing }}
                        underline="hover"
                        onClick={action.onClick}
                    >
                        {action.label}
                    </Link>
                )}
                {action && !inline && (
                    <Box sx={{ mt: 0.5 }}>
                        <Button
                            color="neutral"
                            size="sm"
                            startDecorator={action.icon}
                            sx={{ "&:focus-visible": focusRing }}
                            variant="outlined"
                            onClick={action.onClick}
                        >
                            {action.label}
                        </Button>
                    </Box>
                )}
            </Box>
        );
    }
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
            {title && (
                <Typography
                    level={small ? "title-sm" : "title-md"}
                    sx={{ color: g.text.primary, overflowWrap: "anywhere" }}
                >
                    {title}
                </Typography>
            )}
            {body && (
                <Typography
                    level="body-sm"
                    sx={{
                        color: g.text.secondary,
                        maxWidth: title ? 280 : 320,
                        overflowWrap: "anywhere",
                    }}
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
