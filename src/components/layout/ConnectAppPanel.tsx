import { useCallback, useEffect, useId, useRef, useState } from "react";
import AddLinkRoundedIcon from "@mui/icons-material/AddLinkRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import {
    Alert,
    Box,
    Button,
    Chip,
    Link,
    Sheet,
    Stack,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../context/authState";
import { formatRelativeAge } from "../../features/tasks/utils/relativeAge";
import { fmt, getDocumentDirection, useTranslation } from "../../i18n";
import { fetchAgentFeatures } from "../../services/agentApi";
import { g } from "../../theme/tokens";
import {
    claudeCodeAddCommand,
    PLUGIN_COMMANDS,
    PLUGIN_REPO_URL,
    PLUGIN_ZIP_URL,
} from "../../utils/mcpConnect";
import { smoothScrollBehavior } from "../../utils/motion";
import { AgentQuietNotice } from "./AgentQuietNotice";
import {
    CONNECT_APP_PANEL_ID,
    OPEN_EVENT,
    openPlanUsage,
    takePendingSetup,
} from "./connectAppPanelHelpers";

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
    top: 0,
    insetInlineStart: 0,
    // Strings: a bare 1 in `sx` is 100% (MIP-2059).
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;

/**
 * Text to copy, in a box that is real, selectable text (never an image or an input
 * that hides part of it), with a Copy button beside it. Always left-to-right: an
 * address or a command does not mirror in Arabic. `plain` is for a sentence (the
 * preference) rather than code: the page's font, and the direction its own text asks
 * for (an Arabic sentence reads right-to-left), since it is pasted into another app
 * exactly as shown.
 */
const CopyBox = ({
    label,
    text,
    block,
    plain,
    testId,
    copyAria,
}: {
    label: string;
    text: string;
    /** A command (wraps anywhere, shown as a block) rather than an address. */
    block?: boolean;
    /** A sentence, not code: the page's font instead of the monospace one. */
    plain?: boolean;
    testId: string;
    /** Accessible name of the Copy button; defaults to the address or command wording. */
    copyAria?: string;
}) => {
    const { t } = useTranslation();
    const c = t.settings.connectedApps.connect;
    const { ref, state, copy } = useCopy(text);
    const labelId = useId();
    return (
        <Stack spacing={0.75} sx={{ minWidth: 0, position: "relative" }}>
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
                    dir={plain ? "auto" : "ltr"}
                    translate="no"
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        m: 0,
                        px: 1,
                        py: 0.75,
                        borderRadius: g.radius.sm,
                        border: `1px solid ${g.border.default}`,
                        bgcolor: g.bg.subtle,
                        color: g.text.primary,
                        fontFamily: plain ? "inherit" : g.font.mono,
                        fontSize: { xs: "0.75rem", sm: "0.8125rem" },
                        lineHeight: 1.5,
                        textAlign: plain ? "start" : "left",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        userSelect: "all",
                    }}
                >
                    {text}
                </Box>
                <Button
                    aria-label={copyAria ?? (block ? c.copyCommandAria : c.copyAria)}
                    color="neutral"
                    size="sm"
                    sx={{ flexShrink: 0, minHeight: g.control.md }}
                    variant="outlined"
                    startDecorator={
                        state === "copied" ? (
                            <CheckRoundedIcon sx={{ fontSize: 16 }} />
                        ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                        )
                    }
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

/** A numbered list; `after` hangs a node (a copy box) under the step at that index. */
const Steps = ({
    items,
    after,
}: {
    items: readonly string[];
    after?: { index: number; node: React.ReactNode };
}) => (
    <Box component="ol" sx={{ m: 0, paddingInlineStart: "1.25rem", listStyleType: "decimal" }}>
        {items.map((step, i) => (
            <Typography
                key={step}
                component="li"
                level="body-sm"
                sx={{ display: "list-item", mb: 0.75, "&::marker": { color: g.text.secondary } }}
            >
                {step}
                {after && after.index === i && after.node && (
                    <Box sx={{ mt: 0.75 }}>{after.node}</Box>
                )}
            </Typography>
        ))}
    </Box>
);

type AppTab = "claudeCode" | "claudeDesktop" | "chatgpt";

// Tab rail: three short labels, none of which breaks. Settings never scrolls sideways
// (MIP-2599), so a phone gets tighter tabs and, in a longer language, a second line.
const TAB_SX = {
    flex: "none",
    whiteSpace: "nowrap",
    minHeight: g.control.md,
    px: { xs: 0.75, sm: 1.25 },
    fontSize: "0.8125rem",
} as const;

/**
 * Settings → Developer → "Connect your AI" (MIP-2020): how to connect an AI app the
 * OAuth way (no API key), in one or two steps per app, with a connection check.
 *
 * - Status: "Connected" once the member has a live connection, and when an app last
 *   called Genos (`lastUsedAt`, the most recent over the connections). Not connected
 *   is a neutral line, not an error.
 * - One tab per app (Claude Code, claude.ai / Desktop, ChatGPT), each with its steps.
 * - One optional sentence to paste into the AI's own personal preferences, with a copy
 *   button and where it goes for the selected app.
 * - Free plan: the connector needs Core; says so and links to Plan & Usage.
 *
 * Collapsed when apps are already connected (the list is the point then), open when
 * none are. `address` is "" when the API origin is unknown: the address rows are then
 * left out rather than showing a relative address that would fail once pasted.
 */
export const ConnectAppPanel = ({
    address,
    defaultOpen,
    connectionCount,
    lastActivityAt,
    listKnown,
    quietDays,
}: {
    address: string;
    /** Set when connected but no agent has written anything for this many days (MIP-2022):
     *  one quiet line under the header, shown collapsed or open. */
    quietDays?: number | null;
    defaultOpen: boolean;
    /** False when the connections list failed to load: the status is then unknown, not "none". */
    listKnown: boolean;
    /** How many apps are connected right now. */
    connectionCount: number;
    /** The latest `lastUsedAt` over them (see `latestActivity`), or null. */
    lastActivityAt: string | null;
}) => {
    const { t, locale } = useTranslation();
    const { accessToken } = useAuth();
    const c = t.settings.connectedApps.connect;
    const ai = t.settings.connectedApps.connectAi;
    // `null` until the person (or a pointer elsewhere) decides: the default can change
    // as the list loads, and their choice must then win.
    const [chosen, setChosen] = useState<boolean | null>(null);
    const open = chosen ?? defaultOpen;
    const [tab, setTab] = useState<AppTab>("claudeCode");
    const [isFree, setIsFree] = useState(false);
    const bodyId = useId();
    const titleId = useId();

    // The quiet line's link: open the steps and bring the panel into view.
    const openSetup = useCallback(() => {
        setChosen(true);
        window.requestAnimationFrame(() => {
            document
                .getElementById(CONNECT_APP_PANEL_ID)
                ?.scrollIntoView?.({ block: "start", behavior: smoothScrollBehavior() });
        });
    }, []);

    useEffect(() => {
        const onOpen = () => setChosen(true);
        window.addEventListener(OPEN_EVENT, onOpen);
        // "Check the setup" on the Genos page asked for this panel before it was mounted.
        if (takePendingSetup()) openSetup();
        return () => window.removeEventListener(OPEN_EVENT, onOpen);
    }, [openSetup]);

    // The plan decides one notice only, so a failed read just leaves the notice out.
    useEffect(() => {
        if (!accessToken) return;
        let cancelled = false;
        void fetchAgentFeatures(accessToken).then((features) => {
            if (!cancelled) setIsFree(features?.tier === "free");
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const connected = listKnown && connectionCount > 0;
    const when = lastActivityAt
        ? formatRelativeAge(lastActivityAt, t.tasks.activity, Date.now(), locale)
        : "";
    const preferenceWhere: Record<AppTab, string> = {
        claudeCode: ai.prefWhereClaudeCode,
        claudeDesktop: ai.prefWhereClaudeDesktop,
        chatgpt: ai.prefWhereChatgpt,
    };

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
                startDecorator={<AddLinkRoundedIcon sx={{ fontSize: 18 }} />}
                variant="plain"
                endDecorator={
                    <ExpandMoreRoundedIcon
                        sx={{
                            fontSize: 20,
                            transform: open ? "rotate(180deg)" : "none",
                            transition: `transform ${g.motion.fast}`,
                        }}
                    />
                }
                sx={{
                    width: "100%",
                    justifyContent: "flex-start",
                    minHeight: g.control.lg,
                    px: 1.25,
                    textAlign: "start",
                }}
                onClick={() => setChosen(!open)}
            >
                <Typography id={titleId} level="title-sm" sx={{ flex: 1, textAlign: "start" }}>
                    {ai.title}
                </Typography>
                {connected && !open && (
                    <Chip color="success" size="sm" variant="soft">
                        {ai.statusConnected}
                    </Chip>
                )}
            </Button>
            {connected && quietDays ? (
                <Box sx={{ px: 1.25, pb: open ? 1 : 1.25 }}>
                    <AgentQuietNotice days={quietDays} onCheck={openSetup} />
                </Box>
            ) : null}
            <Box
                aria-labelledby={open ? titleId : undefined}
                id={bodyId}
                role={open ? "region" : undefined}
            >
                {open && (
                    <Stack spacing={2} sx={{ px: 1.25, pb: 1.5, minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {ai.intro}
                        </Typography>

                        {/* The connection check. Not connected is a plain line, not a warning;
                            when the list failed to load there is nothing true to say. */}
                        {listKnown && (
                            <Stack
                                alignItems="flex-start"
                                data-testid="connect-status"
                                direction="row"
                                spacing={1}
                                sx={{ flexWrap: "wrap", minWidth: 0 }}
                                useFlexGap
                            >
                                {connected ? (
                                    <>
                                        <Chip
                                            color="success"
                                            size="sm"
                                            variant="soft"
                                            startDecorator={
                                                <CheckRoundedIcon sx={{ fontSize: 14 }} />
                                            }
                                        >
                                            {ai.statusConnected}
                                        </Chip>
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: g.text.secondary, flex: 1, minWidth: 0 }}
                                        >
                                            {when
                                                ? fmt(ai.statusActivity, { when })
                                                : ai.statusNoActivity}
                                        </Typography>
                                    </>
                                ) : (
                                    <>
                                        <LinkOffRoundedIcon
                                            sx={{
                                                fontSize: 18,
                                                color: g.text.tertiary,
                                                mt: 0.125,
                                            }}
                                        />
                                        <Typography
                                            level="body-sm"
                                            sx={{ color: g.text.secondary, flex: 1, minWidth: 0 }}
                                        >
                                            {ai.statusNone}
                                        </Typography>
                                    </>
                                )}
                            </Stack>
                        )}

                        {isFree && (
                            <Alert
                                color="warning"
                                data-testid="connect-free-plan"
                                size="sm"
                                sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
                                variant="soft"
                                endDecorator={
                                    <Button
                                        color="warning"
                                        size="sm"
                                        variant="outlined"
                                        onClick={openPlanUsage}
                                    >
                                        {t.settings.tabs.planUsage}
                                    </Button>
                                }
                            >
                                {ai.freePlan}
                            </Alert>
                        )}

                        <Tabs
                            direction={getDocumentDirection()}
                            sx={{ bgcolor: "transparent", minWidth: 0 }}
                            value={tab}
                            onChange={(_e, v) => {
                                if (typeof v === "string") setTab(v as AppTab);
                            }}
                        >
                            <TabList
                                aria-label={ai.tabsAria}
                                sx={{ gap: { xs: 0, sm: 0.5 }, mb: 1.5, flexWrap: "wrap" }}
                            >
                                <Tab sx={TAB_SX} value="claudeCode">
                                    {ai.tabClaudeCode}
                                </Tab>
                                <Tab sx={TAB_SX} value="claudeDesktop">
                                    {ai.tabClaudeDesktop}
                                </Tab>
                                <Tab sx={TAB_SX} value="chatgpt">
                                    {ai.tabChatgpt}
                                </Tab>
                            </TabList>

                            <TabPanel sx={{ p: 0 }} value="claudeCode">
                                <Stack spacing={1.5}>
                                    <Steps
                                        items={ai.claudeCodeSteps}
                                        after={{
                                            index: 0,
                                            node: (
                                                <CopyBox
                                                    copyAria={ai.claudeCodeCommandAria}
                                                    label={ai.claudeCodeCommandLabel}
                                                    testId="mcp-plugin-command"
                                                    text={PLUGIN_COMMANDS}
                                                    block
                                                />
                                            ),
                                        }}
                                    />
                                    {address && (
                                        <CopyBox
                                            label={ai.claudeCodeAloneLabel}
                                            testId="mcp-command"
                                            text={claudeCodeAddCommand(address)}
                                            block
                                        />
                                    )}
                                    <Typography level="body-sm">
                                        <Link
                                            href={PLUGIN_REPO_URL}
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            {c.pluginRepoLink}
                                        </Link>
                                    </Typography>
                                </Stack>
                            </TabPanel>

                            <TabPanel sx={{ p: 0 }} value="claudeDesktop">
                                <Stack spacing={1.5}>
                                    <Steps
                                        items={ai.claudeDesktopSteps}
                                        after={
                                            address
                                                ? {
                                                      index: 0,
                                                      node: (
                                                          <CopyBox
                                                              label={ai.claudeDesktopAddressLabel}
                                                              testId="mcp-address"
                                                              text={address}
                                                          />
                                                      ),
                                                  }
                                                : undefined
                                        }
                                    />
                                    {/* The trap is about the pasted address and names Claude, so only this tab shows it. */}
                                    <Alert color="warning" size="sm" variant="soft">
                                        {c.trap}
                                    </Alert>
                                    <Stack spacing={0.75}>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: g.text.secondary }}
                                        >
                                            {c.pluginDesktopLabel}
                                        </Typography>
                                        <Box>
                                            <Button
                                                color="neutral"
                                                component="a"
                                                href={PLUGIN_ZIP_URL}
                                                rel="noopener noreferrer"
                                                size="sm"
                                                target="_blank"
                                                variant="outlined"
                                            >
                                                {c.pluginZipLink}
                                            </Button>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </TabPanel>

                            <TabPanel sx={{ p: 0 }} value="chatgpt">
                                <Stack spacing={1.5}>
                                    <Steps
                                        items={ai.chatgptSteps}
                                        after={
                                            address
                                                ? {
                                                      index: 1,
                                                      node: (
                                                          <CopyBox
                                                              label={ai.chatgptAddressLabel}
                                                              testId="mcp-address"
                                                              text={address}
                                                          />
                                                      ),
                                                  }
                                                : undefined
                                        }
                                    />
                                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                        {ai.chatgptNote}
                                    </Typography>
                                </Stack>
                            </TabPanel>
                        </Tabs>

                        {/* The optional one-line preference, with where it goes for the chosen app. */}
                        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                            <Typography level="title-sm">{ai.prefTitle}</Typography>
                            <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                {ai.prefIntro}
                            </Typography>
                            <CopyBox
                                copyAria={ai.prefCopyAria}
                                label={ai.prefLabel}
                                testId="mcp-preference"
                                text={ai.prefText}
                                plain
                            />
                            <Typography
                                data-testid="mcp-preference-where"
                                level="body-xs"
                                sx={{ color: g.text.secondary }}
                            >
                                {preferenceWhere[tab]}
                            </Typography>
                        </Stack>

                        <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                            {c.revoke}
                        </Typography>
                    </Stack>
                )}
            </Box>
        </Sheet>
    );
};
