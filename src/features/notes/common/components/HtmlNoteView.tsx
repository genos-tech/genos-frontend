import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import WebRoundedIcon from "@mui/icons-material/WebRounded";
import { Box, Typography } from "@mui/joy";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { onHtmlNoteReload } from "../services/htmlNoteReload";
import { loadHtmlNote } from "../services/loadHtmlNote";
import { buildHtmlSrcdoc, HTML_NOTE_LOADED_KEY, HTML_NOTE_SANDBOX } from "../utils/htmlNote";
import { NoteLoadState } from "./NoteLoadState";

/** How long after the frame's `load` its own document gets to say it finished loading. A document
 *  that was replaced while it parsed never says it, and one that did arrives within a task or two. */
export const HTML_NOTE_LOADED_GRACE_MS = 1500;

type HtmlNoteViewProps = {
    noteType: number;
    noteId: number;
    title: string;
    accessToken: string | null;
    /** Only the open note's frame is mounted: a page that spins must cost one tab, not every open
     *  note's, and a page that was left behind stops running. */
    isActive: boolean;
    /** Phone: stretch to the host's leftover height (it is pinned); otherwise the frame takes a
     *  height tied to the window and the page scrolls inside it. */
    fillHeight?: boolean;
};

type Phase = "loading" | "error" | "ready";

const newNonce = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/**
 * An HTML note (MIP-2215): one saved HTML page, read-only, in a sandboxed frame in the note pane.
 *
 * Never mounts BlockNote or Yjs: the editor panels branch to this before they build either.
 *
 * THE FRAME: `sandbox="allow-scripts"` and nothing else (an opaque origin: no cookies, storage,
 * parent DOM or popups), `srcdoc` with our CSP first (`buildHtmlSrcdoc`), `referrerpolicy` none and
 * lazy loading. The page is untrusted: this component never reads anything out of it.
 *
 * SELF-NAVIGATION: CSP cannot stop a frame from navigating itself, so a page could swap itself for a
 * look-alike sign-in page. The frame is therefore watched. A second `load` means it navigated after
 * loading; a `load` that our own document never confirmed (see `loadedSentinel`) means it navigated
 * while parsing. Either way the frame is REMOVED and replaced by a notice with Reload, so a
 * replacement page is never left on screen. The request the navigation made cannot be recalled:
 * the label and this notice are the mitigation, as the plan says.
 */
export const HtmlNoteView = ({
    noteType,
    noteId,
    title,
    accessToken,
    isActive,
    fillHeight = false,
}: HtmlNoteViewProps) => {
    const { t } = useTranslation();
    const [phase, setPhase] = useState<Phase>("loading");
    const [page, setPage] = useState<{ html: string; rev: number } | null>(null);
    const [navigated, setNavigated] = useState(false);
    // Bumped by every reload: refetch the page and remount the frame.
    const [nonce, setNonce] = useState(0);
    const [frameKey, setFrameKey] = useState(() => newNonce());

    const reload = useCallback(() => {
        setNavigated(false);
        setPhase("loading");
        setNonce((n) => n + 1);
    }, []);

    // Fetch while this tab is the open one, once per Reload: coming back to a tab keeps the page it
    // already holds. A fetch cut short by leaving the tab is not counted as done.
    const fetchedNonceRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isActive || fetchedNonceRef.current === nonce) return;
        const controller = new AbortController();
        let cancelled = false;
        loadHtmlNote(noteType, noteId, accessToken, controller.signal)
            .then((loaded) => {
                if (cancelled) return;
                fetchedNonceRef.current = nonce;
                setPage({ html: loaded.html, rev: loaded.rev });
                setFrameKey(newNonce());
                setPhase("ready");
            })
            .catch(() => {
                if (!cancelled) setPhase("error");
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [isActive, noteType, noteId, accessToken, nonce]);

    useEffect(() => onHtmlNoteReload(noteType, noteId, reload), [noteType, noteId, reload]);

    // A frame that comes back after the tab was left starts clean: counters and the verdict reset.
    const frameActive = isActive && phase === "ready" && !navigated;
    const srcDoc = useMemo(
        () => (page ? buildHtmlSrcdoc(page.html, frameKey) : ""),
        [page, frameKey]
    );

    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const loadsRef = useRef(0);
    const confirmedRef = useRef(false);
    const graceTimerRef = useRef<number | null>(null);

    const clearGrace = useCallback(() => {
        if (graceTimerRef.current !== null) {
            window.clearTimeout(graceTimerRef.current);
            graceTimerRef.current = null;
        }
    }, []);

    // Each frame (a new key) starts its own count; leaving the tab or unmounting stops the timer.
    useEffect(() => {
        loadsRef.current = 0;
        confirmedRef.current = false;
        return clearGrace;
    }, [frameKey, frameActive, clearGrace]);

    // The sentinel's message. Only a message from THIS frame carrying THIS frame's nonce counts.
    useEffect(() => {
        if (!frameActive) return;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== frameRef.current?.contentWindow) return;
            const data = event.data as Record<string, unknown> | null;
            if (data && typeof data === "object" && data[HTML_NOTE_LOADED_KEY] === frameKey) {
                confirmedRef.current = true;
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameActive, frameKey]);

    const handleFrameLoad = () => {
        loadsRef.current += 1;
        if (loadsRef.current > 1) {
            clearGrace();
            setNavigated(true);
            return;
        }
        // The first load: our own document must confirm it is the one that loaded.
        clearGrace();
        graceTimerRef.current = window.setTimeout(() => {
            graceTimerRef.current = null;
            if (!confirmedRef.current) setNavigated(true);
        }, HTML_NOTE_LOADED_GRACE_MS);
    };

    if (!isActive && !page) {
        // Never opened: nothing to show and nothing to fetch yet.
        return null;
    }

    if (phase !== "ready") {
        return (
            <NoteLoadState
                error={phase === "error"}
                fillHeight={fillHeight}
                isActive={isActive}
                isLoading={phase === "loading"}
                onRetry={reload}
            />
        );
    }

    return (
        <Box
            data-html-note=""
            sx={{
                display: isActive ? "flex" : "none",
                flexDirection: "column",
                width: "100%",
                minWidth: 0,
                paddingX: { xs: "12px", md: "var(--note-body-start, 50px)" },
                paddingBottom: "8px",
                ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
            }}
        >
            <Typography
                level={fillHeight ? "h3" : "h2"}
                sx={{
                    color: g.text.primary,
                    overflowWrap: "anywhere",
                    marginTop: { xs: "8px", md: "12px" },
                }}
            >
                {title}
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "10px",
                    color: g.text.secondary,
                }}
            >
                <WebRoundedIcon sx={{ fontSize: 16 }} aria-hidden />
                <Typography level="body-sm" sx={{ color: "inherit" }}>
                    {t.notes.htmlNote.label}
                </Typography>
            </Box>
            {navigated ? (
                <EmptyState
                    body={t.notes.htmlNote.navigatedBody}
                    data-empty="html-note-navigated"
                    fill={fillHeight}
                    title={t.notes.htmlNote.navigatedTitle}
                    action={{
                        label: t.notes.htmlNote.reload,
                        onClick: reload,
                        icon: <ReplayRoundedIcon />,
                    }}
                />
            ) : (
                frameActive && (
                    <Box
                        sx={{
                            flex: fillHeight ? 1 : "none",
                            minHeight: fillHeight ? 0 : 420,
                            // `--app-vh` is the shell's height (the viewport less the notification
                            // banner); 180px leaves room for the header, tab strip, title and label.
                            height: fillHeight ? "auto" : "calc(var(--app-vh) - 180px)",
                            border: "1px solid",
                            borderColor: g.border.default,
                            borderRadius: g.radius.md,
                            overflow: "hidden",
                            // The page draws its own background; this is only what shows while it loads.
                            backgroundColor: "white",
                        }}
                    >
                        <iframe
                            key={frameKey}
                            ref={frameRef}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            sandbox={HTML_NOTE_SANDBOX}
                            srcDoc={srcDoc}
                            style={{ display: "block", width: "100%", height: "100%", border: 0 }}
                            title={fmt(t.notes.htmlNote.frameTitle, { title })}
                            onLoad={handleFrameLoad}
                        />
                    </Box>
                )
            )}
        </Box>
    );
};
