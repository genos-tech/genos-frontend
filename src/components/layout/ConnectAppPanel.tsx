import { useCallback, useEffect, useId, useRef, useState } from "react";
import AddLinkRoundedIcon from "@mui/icons-material/AddLinkRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Alert, Box, Button, Sheet, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { g } from "../../theme/tokens";
import { claudeCodeAddCommand } from "../../utils/mcpConnect";

/** The panel's anchor, and the window event that opens it (see `openConnectAppPanel`). */
export const CONNECT_APP_PANEL_ID = "connect-ai-app";
const OPEN_EVENT = "genos:open-connect-app";

/**
 * Open the "Connect an AI app" panel (if it is on screen) and bring it into view. A
 * no-op when it is not mounted, so any surface can point at it. The API-keys block
 * sits in a sibling component, hence an event rather than shared state.
 */
export const openConnectAppPanel = () => {
    window.dispatchEvent(new Event(OPEN_EVENT));
    window.requestAnimationFrame(() => {
        document
            .getElementById(CONNECT_APP_PANEL_ID)
            ?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    });
};

const COPIED_MS = 1500;

/** Select a node's text, the fallback when the clipboard is unavailable or refuses. */
const selectText = (node: HTMLElement | null) => {
    if (!node) return;
    try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(node);
        selection?.removeAllRanges();
        selection?.addRange(range);
    } catch {
        // Nothing more to do: the text is still on screen and selectable by hand.
    }
};

/**
 * Copy `text`, or (clipboard missing, blocked in an iframe or a plain-http page, or
 * refused) select it in `ref` and say so, so the person can press the keys themselves.
 */
const useCopy = (text: string) => {
    const ref = useRef<HTMLElement | null>(null);
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copy = useCallback(async () => {
        window.clearTimeout(timer.current);
        try {
            if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
            await navigator.clipboard.writeText(text);
            setState("copied");
            timer.current = window.setTimeout(() => setState("idle"), COPIED_MS);
        } catch {
            selectText(ref.current);
            setState("failed");
        }
    }, [text]);

    return { ref, state, copy };
};

const visuallyHidden = {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;

/**
 * Text to copy, in a box that is real, selectable text (never an image or an input
 * that hides part of it), with a Copy button beside it. Always left-to-right: an
 * address or a command does not mirror in Arabic.
 */
const CopyBox = ({
    label,
    text,
    block,
    testId,
}: {
    label: string;
    text: string;
    /** A command (wraps anywhere, shown as a block) rather than an address. */
    block?: boolean;
    testId: string;
}) => {
    const { t } = useTranslation();
    const c = t.settings.connectedApps.connect;
    const { ref, state, copy } = useCopy(text);
    const labelId = useId();
    return (
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography id={labelId} level="body-xs" sx={{ color: g.text.secondary }}>
                {label}
            </Typography>
            <Stack
                alignItems={{ xs: "stretch", sm: "flex-start" }}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ minWidth: 0 }}
            >
                <Box
                    ref={ref}
                    aria-labelledby={labelId}
                    component={block ? "pre" : "code"}
                    data-testid={testId}
                    dir="ltr"
                    translate="no"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        m: 0,
                        px: 1.25,
                        py: 0.75,
                        borderRadius: g.radius.sm,
                        border: `1px solid ${g.border.default}`,
                        bgcolor: g.bg.subtle,
                        color: g.text.primary,
                        fontFamily: g.font.mono,
                        fontSize: "0.8125rem",
                        lineHeight: 1.5,
                        textAlign: "left",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        userSelect: "all",
                    }}
                >
                    {text}
                </Box>
                <Button
                    aria-label={block ? c.copyCommandAria : c.copyAria}
                    color="neutral"
                    size="sm"
                    startDecorator={
                        state === "copied" ? (
                            <CheckRoundedIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                        )
                    }
                    sx={{ flexShrink: 0, minHeight: g.control.md }}
                    variant="outlined"
                    onClick={() => void copy()}
                >
                    {state === "copied" ? c.copied : c.copy}
                </Button>
            </Stack>
            {state === "failed" && (
                <Typography level="body-xs" role="status" sx={{ color: g.warning.text }}>
                    {c.copyFailed}
                </Typography>
            )}
            {/* "Copied" is also announced: the button's own label changes in place. */}
            <Box aria-live="polite" role="status" sx={visuallyHidden}>
                {state === "copied" ? c.copied : ""}
            </Box>
        </Stack>
    );
};

const Steps = ({
    items,
    afterFirst,
}: {
    items: readonly string[];
    afterFirst?: React.ReactNode;
}) => (
    <Box
        component="ol"
        sx={{
            m: 0,
            paddingInlineStart: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
        }}
    >
        {items.map((step, i) => (
            <Typography key={step} component="li" level="body-sm">
                {step}
                {i === 0 && afterFirst && <Box sx={{ mt: 0.75 }}>{afterFirst}</Box>}
            </Typography>
        ))}
    </Box>
);

/**
 * Settings → Developer → Connected apps: how to connect an AI app the OAuth way
 * (no API key). The address to paste, one short list of steps per app, and the three
 * things people trip on: the plan, how to undo it, and the address typed in full.
 *
 * Collapsed when apps are already connected (the list is the point then), open when
 * none are. `address` is "" when the API origin is unknown: the row is then left out
 * rather than showing a relative address that would fail once pasted.
 */
export const ConnectAppPanel = ({
    address,
    defaultOpen,
}: {
    address: string;
    defaultOpen: boolean;
}) => {
    const { t } = useTranslation();
    const c = t.settings.connectedApps.connect;
    // `null` until the person (or a pointer elsewhere) decides: the default can change
    // as the list loads, and their choice must then win.
    const [chosen, setChosen] = useState<boolean | null>(null);
    const open = chosen ?? defaultOpen;
    const bodyId = useId();
    const titleId = useId();

    useEffect(() => {
        const onOpen = () => setChosen(true);
        window.addEventListener(OPEN_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_EVENT, onOpen);
    }, []);

    return (
        <Sheet
            data-testid="connect-app-panel"
            id={CONNECT_APP_PANEL_ID}
            sx={{ borderRadius: 8, minWidth: 0, scrollMarginTop: 8 }}
            variant="outlined"
        >
            <Button
                aria-controls={bodyId}
                aria-expanded={open}
                color="neutral"
                endDecorator={
                    <ExpandMoreRoundedIcon
                        sx={{
                            fontSize: 20,
                            transform: open ? "rotate(180deg)" : "none",
                            transition: `transform ${g.motion.fast}`,
                        }}
                    />
                }
                startDecorator={<AddLinkRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{
                    width: "100%",
                    justifyContent: "flex-start",
                    minHeight: g.control.lg,
                    px: 1.25,
                    textAlign: "start",
                }}
                variant="plain"
                onClick={() => setChosen(!open)}
            >
                <Typography id={titleId} level="title-sm" sx={{ flex: 1, textAlign: "start" }}>
                    {c.title}
                </Typography>
            </Button>
            <Box
                id={bodyId}
                aria-labelledby={open ? titleId : undefined}
                role={open ? "region" : undefined}
            >
                {open && (
                    <Stack spacing={2} sx={{ px: 1.25, pb: 1.5, minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {c.intro}
                        </Typography>

                        {address && (
                            <CopyBox label={c.urlLabel} testId="mcp-address" text={address} />
                        )}

                        <Stack spacing={0.75}>
                            <Typography level="title-sm">{c.claudeTitle}</Typography>
                            <Steps items={c.claudeSteps} />
                        </Stack>

                        <Stack spacing={0.75}>
                            <Typography level="title-sm">{c.claudeCodeTitle}</Typography>
                            <Steps
                                afterFirst={
                                    address && (
                                        <CopyBox
                                            block
                                            label={c.codeLabel}
                                            testId="mcp-command"
                                            text={claudeCodeAddCommand(address)}
                                        />
                                    )
                                }
                                items={c.claudeCodeSteps}
                            />
                        </Stack>

                        <Stack spacing={0.5}>
                            <Typography level="title-sm">{c.chatgptTitle}</Typography>
                            <Typography level="body-sm">{c.chatgptBody}</Typography>
                        </Stack>

                        <Stack spacing={0.75}>
                            <Alert color="warning" size="sm" variant="soft">
                                {c.trap}
                            </Alert>
                            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                {c.plan}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                {c.revoke}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                {c.menuNote}
                            </Typography>
                        </Stack>
                    </Stack>
                )}
            </Box>
        </Sheet>
    );
};
