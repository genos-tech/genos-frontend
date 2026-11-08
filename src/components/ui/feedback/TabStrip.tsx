import { KeyboardEvent, ReactNode, useEffect, useRef } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, Typography } from "@mui/joy";

import { focusRing, g, type } from "../../../theme/tokens";

/**
 * The one tab strip (MIP-1132). The thread tabs, the inbox tabs and three
 * near-identical note tab lists each hand-built their own: different
 * heights, a gradient pill here, an underline there, and (for two of them)
 * plain buttons a screen reader never heard as tabs.
 *
 * Flat, quiet: the selected tab is primary text with a 2 px accent
 * underline; the rest are secondary text with a hover fill. It is a real
 * `tablist`: roving tabindex, Arrow keys (mirrored in right-to-left),
 * Home / End, and `aria-selected`. Narrow screens scroll the strip
 * sideways instead of squeezing labels, and the selected tab scrolls into
 * view.
 *
 * Close buttons stay OUT of the tablist: a `tablist` may only own `tab`s
 * (axe: aria-required-children, critical), so the visible x is a pointer /
 * touch affordance (`aria-hidden`), the keyboard path is Delete on the tab
 * (`aria-keyshortcuts`), and screen-reader browse mode gets real "Close
 * <title>" buttons in a visually hidden group after the strip (MIP-1173).
 *
 * It does not render the panels; the caller shows the content for `value`.
 * Give each tab a `panelId` and the panel `role="tabpanel"` with that id to
 * link them for assistive tech.
 */

export type TabItem = {
    id: string;
    label: ReactNode;
    icon?: ReactNode;
    /** A count after the label (unread, pending). Hidden at 0 or unset. */
    count?: number;
    /** Accent the count: something needs the person's attention. */
    attention?: boolean;
    disabled?: boolean;
    /** Shows a close button after the label (note tabs). */
    closable?: boolean;
    /** `id` of the panel this tab controls. */
    panelId?: string;
    /** Native hint for a truncated label. */
    title?: string;
};

type TabStripProps = {
    tabs: TabItem[];
    value: string;
    onChange: (id: string) => void;
    onClose?: (id: string) => void;
    /** Names the group for assistive tech ("Inbox sections"). Localized. */
    ariaLabel: string;
    /** Accessible name of each close button. Localized; needed with `onClose`. */
    closeLabel?: string;
    /** `sm` is 28 px tall (inside a panel); `md` 32 px (a page's own tabs). */
    size?: "sm" | "md";
    /** Cap a long label (note titles) at this width. */
    maxLabelWidth?: number;
    /** Draw the baseline under the whole strip. Default true. */
    baseline?: boolean;
};

export const TabStrip = ({
    tabs,
    value,
    onChange,
    onClose,
    ariaLabel,
    closeLabel,
    size = "md",
    maxLabelWidth,
    baseline = true,
}: TabStripProps) => {
    const listRef = useRef<HTMLDivElement>(null);

    // Keep the selected tab visible when the strip scrolls (many note tabs).
    useEffect(() => {
        const el = listRef.current?.querySelector<HTMLElement>(
            '[role="tab"][aria-selected="true"]'
        );
        el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }, [value, tabs.length]);

    // A mouse wheel only moves vertically, which would leave a strip with
    // many tabs (open notes) unreachable without a trackpad: turn it into a
    // sideways scroll while the strip overflows. Non-passive so it can stop
    // the page from scrolling too.
    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (el.scrollWidth <= el.clientWidth) return;
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const enabled = tabs.filter((t) => !t.disabled);
    // The one tab stop is the selected tab. If `value` matches none (a tab
    // just closed, a transient index) the first enabled tab takes it, so the
    // strip is never unreachable by keyboard.
    const stopId = tabs.some((t) => t.id === value) ? value : enabled[0]?.id;

    const focusTab = (id: string) =>
        requestAnimationFrame(() => {
            listRef.current
                ?.querySelector<HTMLElement>(`[role="tab"][data-tab-id="${CSS.escape(id)}"]`)
                ?.focus();
        });

    // The closed tab's node is about to go; hand focus to its neighbour
    // instead of letting it fall to <body>.
    const closeAndHandOff = (id: string) => {
        onClose?.(id);
        const at = tabs.findIndex((t) => t.id === id);
        const neighbour = [...tabs.slice(at + 1), ...tabs.slice(0, at).reverse()].find(
            (t) => !t.disabled
        );
        if (neighbour) focusTab(neighbour.id);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Delete" && onClose) {
            const focused = (e.target as HTMLElement).closest<HTMLElement>("[data-tab-id]");
            const tab = tabs.find((t) => t.id === focused?.dataset.tabId);
            if (tab?.closable) {
                e.preventDefault();
                closeAndHandOff(tab.id);
            }
            return;
        }
        if (enabled.length === 0) return;
        const idx = Math.max(
            0,
            enabled.findIndex((t) => t.id === stopId)
        );
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        let next = -1;
        if (e.key === "ArrowRight") next = idx + (rtl ? -1 : 1);
        else if (e.key === "ArrowLeft") next = idx + (rtl ? 1 : -1);
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = enabled.length - 1;
        else return;
        e.preventDefault();
        next = (next + enabled.length) % enabled.length;
        const target = enabled[next];
        onChange(target.id);
        // The new tab mounts selected on the next render; focus it then.
        requestAnimationFrame(() => {
            listRef.current
                ?.querySelector<HTMLElement>(
                    `[role="tab"][data-tab-id="${CSS.escape(target.id)}"]`
                )
                ?.focus();
        });
    };

    const height = size === "sm" ? g.control.sm : g.control.md;

    const closables = onClose ? tabs.filter((t) => t.closable) : [];

    return (
        <Box sx={{ display: "flex", minWidth: 0, position: "relative" }}>
            <Box
                ref={listRef}
                aria-label={ariaLabel}
                role="tablist"
                sx={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 0.5,
                    flex: "1 1 auto",
                    minWidth: 0,
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": { display: "none" },
                    ...(baseline ? { boxShadow: `inset 0 -1px 0 ${g.border.subtle}` } : null),
                }}
                onKeyDown={onKeyDown}
            >
                {tabs.map((tab) => {
                    const selected = tab.id === value;
                    return (
                        <Box
                            key={tab.id}
                            role="presentation"
                            sx={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                flexShrink: 0,
                                borderRadius: `${g.radius.sm} ${g.radius.sm} 0 0`,
                                "&:hover": tab.disabled ? undefined : { background: g.hover },
                                // The underline sits on the strip's baseline.
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    insetInline: 8,
                                    bottom: 0,
                                    height: 2,
                                    borderRadius: 2,
                                    background: selected ? g.accent.solid : "transparent",
                                },
                            }}
                        >
                            <Box
                                aria-controls={tab.panelId}
                                aria-keyshortcuts={tab.closable && onClose ? "Delete" : undefined}
                                aria-selected={selected}
                                component="button"
                                data-tab-id={tab.id}
                                disabled={tab.disabled}
                                role="tab"
                                tabIndex={tab.id === stopId ? 0 : -1}
                                title={tab.title}
                                type="button"
                                sx={{
                                    all: "unset",
                                    boxSizing: "border-box",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.75,
                                    height,
                                    px: 1.25,
                                    cursor: tab.disabled ? "default" : "pointer",
                                    color: selected ? g.text.primary : g.text.secondary,
                                    opacity: tab.disabled ? 0.5 : 1,
                                    ...type("body-sm"),
                                    fontWeight: selected ? 600 : 500,
                                    transition: `color ${g.motion.fast} ${g.ease}`,
                                    "&:focus-visible": { ...focusRing, borderRadius: g.radius.sm },
                                    "&:hover": tab.disabled
                                        ? undefined
                                        : { color: g.text.primary },
                                }}
                                onClick={() => !tab.disabled && onChange(tab.id)}
                            >
                                {tab.icon && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            "--Icon-color": "currentColor",
                                            "& svg": { fontSize: 16 },
                                        }}
                                        aria-hidden
                                    >
                                        {tab.icon}
                                    </Box>
                                )}
                                <Box
                                    component="span"
                                    sx={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        ...(maxLabelWidth ? { maxWidth: maxLabelWidth } : null),
                                    }}
                                >
                                    {tab.label}
                                </Box>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <Typography
                                        component="span"
                                        sx={{
                                            ...type("caption"),
                                            minWidth: 18,
                                            height: 18,
                                            px: 0.75,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: g.radius.full,
                                            background: tab.attention ? g.accent.solid : g.active,
                                            color: tab.attention ? g.accent.fg : g.text.secondary,
                                        }}
                                    >
                                        {tab.count > 99 ? "99+" : tab.count}
                                    </Typography>
                                )}
                            </Box>
                            {tab.closable && onClose && (
                                <Box
                                    component="span"
                                    data-tab-close={tab.id}
                                    title={closeLabel}
                                    sx={{
                                        boxSizing: "border-box",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 18,
                                        height: 18,
                                        mr: 0.75,
                                        borderRadius: g.radius.xs,
                                        cursor: "pointer",
                                        color: g.text.tertiary,
                                        "--Icon-color": "currentColor",
                                        "&:hover": { background: g.active, color: g.text.primary },
                                    }}
                                    aria-hidden
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose(tab.id);
                                    }}
                                >
                                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
            {closables.length > 0 && (
                <Box
                    aria-label={closeLabel}
                    role="group"
                    sx={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        overflow: "hidden",
                        clip: "rect(0 0 0 0)",
                        whiteSpace: "nowrap",
                    }}
                >
                    {closables.map((tab) => (
                        <button
                            key={tab.id}
                            tabIndex={-1}
                            type="button"
                            aria-label={
                                typeof tab.title === "string" && tab.title
                                    ? `${closeLabel}: ${tab.title}`
                                    : closeLabel
                            }
                            onClick={() => closeAndHandOff(tab.id)}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
};
