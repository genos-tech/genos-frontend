import { ReactNode } from "react";
import { Box, Typography } from "@mui/joy";

import { g, type } from "../../../theme/tokens";
import { pageHeaderFrameSx } from "./pageHeaderFrame";

/**
 * The one top bar of a main surface (MIP-1134, part of MIP-1106).
 *
 * Before this, Inbox had a gradient title with a subtitle, Tasks a raised
 * project card, and Chat and Notes had their own bars of 64 / 56 px, so the
 * app's pages did not start on the same line. Now every top bar is the same
 * quiet strip: a hairline under it, the page background behind it, no shadow,
 * no gradient, the same height.
 *
 *     [leading]  Title                [children]            [actions]
 *                subtitle
 *
 * - `title` is the page's `h1`. `subtitle` is one line of context and is
 *   dropped on a phone: the bar is chrome, and chrome height comes straight
 *   out of the list under it.
 * - `children` is the flexible middle (Tasks puts its project search there).
 * - `actions` sits at the inline end, so it mirrors in `ar`.
 *
 * Who uses it: Inbox and Tasks render it. The chat pane's channel header carries
 * state and menus, so it keeps its content and wears the same frame
 * (`pageHeaderFrameSx`) instead of being wrapped in a second bar. The notes
 * pane's breadcrumb + tab strip and the Genos landing page keep their own top:
 * a bar there would cost a row of height for nothing.
 */

type PageHeaderProps = {
    title: ReactNode;
    /** One line of context under the title; hidden on a phone. */
    subtitle?: ReactNode;
    /** Before the title: an icon or an avatar. */
    leading?: ReactNode;
    /** The flexible middle (a search box). */
    children?: ReactNode;
    /** At the inline end: buttons. */
    actions?: ReactNode;
    /** For tests and the screenshot harness. */
    "data-testid"?: string;
};

/** A slot is filled by anything but nothing: `0` and `""` are not slots, `false` is not one. */
const has = (node: ReactNode): boolean =>
    node !== undefined && node !== null && node !== false && node !== "" && node !== 0;

/** Below this bar width the middle slot (a search box) drops under the title row instead of
 *  being squeezed to nothing: Tasks with a preview open has a bar about 340-550px wide. */
const WRAP_BELOW = "640px";

export const PageHeader = ({
    title,
    subtitle,
    leading,
    children,
    actions,
    "data-testid": testId,
}: PageHeaderProps) => (
    <Box
        component="header"
        data-page-header=""
        data-testid={testId}
        sx={{
            ...pageHeaderFrameSx,
            display: "flex",
            alignItems: "center",
            // The bar is a size container: it answers to its own width, not the window's
            // (a half-width pane in a wide window is the narrow case).
            containerType: "inline-size",
            [`@container (max-width: ${WRAP_BELOW})`]: {
                "& [data-page-header-row]": { py: 1 },
                "& [data-page-header-middle]": {
                    order: 3,
                    flexBasis: "100%",
                    maxWidth: "none",
                    mx: 0,
                },
            },
        }}
    >
        <Box
            data-page-header-row=""
            sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                width: "100%",
                minWidth: 0,
                rowGap: 1,
                columnGap: { xs: 1, md: 1.5 },
            }}
        >
            {has(leading) && (
                <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{leading}</Box>
            )}
            <Box
                sx={{
                    minWidth: 0,
                    flex: "0 1 auto",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                }}
            >
                <Typography
                    component="h1"
                    sx={{ ...type("title-lg"), color: g.text.primary }}
                    noWrap
                >
                    {title}
                </Typography>
                {has(subtitle) && (
                    <Typography
                        sx={{
                            ...type("body-xs"),
                            color: g.text.secondary,
                            display: { xs: "none", sm: "block" },
                        }}
                        noWrap
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>
            {has(children) && (
                <Box
                    data-page-header-middle=""
                    sx={{ flex: "1 1 200px", minWidth: 0, maxWidth: 600, mx: { xs: 0, md: 2 } }}
                >
                    {children}
                </Box>
            )}
            {has(actions) && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexShrink: 0,
                        marginInlineStart: "auto",
                    }}
                >
                    {actions}
                </Box>
            )}
        </Box>
    </Box>
);
