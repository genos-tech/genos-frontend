import { useCallback, useEffect, useRef, useState } from "react";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import WebRoundedIcon from "@mui/icons-material/WebRounded";
import { Box, Typography } from "@mui/joy";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import { fmt, useTranslation } from "../../../../i18n";
import { openAppUrl } from "../../../../services/notifications/openAppUrl";
import { g } from "../../../../theme/tokens";
import { onHtmlNoteReload } from "../services/htmlNoteReload";
import { loadHtmlNoteFrame } from "../services/loadHtmlNote";
import {
    HTML_NOTE_LOADED_KEY,
    HTML_NOTE_OPEN_KEY,
    HTML_NOTE_SANDBOX,
    isHtmlNotePageLink,
} from "../utils/htmlNote";
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

/** The title and label row keep the note text margin; the frame itself only keeps a small margin
 *  (MIP-2315) so a page gets nearly the whole pane, which side panels need most. */
const TEXT_INSET = { xs: "12px", md: "var(--note-body-start, 50px)" };
const FRAME_INSET = { xs: "12px", md: "16px" };

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
 * parent DOM or popups), `src` = the page's own short-lived URL on the API host (MIP-2228: the API
 * answers it with a header CSP of its own, so the page's inline scripts run even under the app's
 * `script-src 'self'`, which a `srcdoc` frame would inherit), `referrerpolicy` none and lazy loading.
 * The app's CSP `frame-src` allows that route and nothing else. The page is untrusted: this component
 * never reads anything out of it.
 *
 * LINKS (MIP-2417): one exception, for a page the SERVER drew (a dashboard), which the API says with
 * `links`. A click on a link in such a page arrives as a message from this frame carrying the nonce;
 * the path is opened in the app only when it is one of the shapes in `isHtmlNotePageLink`. Nothing
 * is added to the sandbox, and a page a person or an AI app saved is never listened to.
 *
 * THE URL: a signed token good for ONE frame load (and ten minutes at most), asked for with the
 * signed-in session (the note's own ACL decides). Single use is what keeps the page's own script,
 * which can read its URL, from handing it to a server of its own to learn the nonce below. So every
 * frame mount asks for a fresh URL: a tab that was left and comes back, and Reload.
 *
 * SELF-NAVIGATION: CSP cannot stop a frame from navigating itself, so a page could swap itself for a
 * look-alike sign-in page. The frame is therefore watched. A second `load` means it navigated after
 * loading; a `load` that our own document never confirmed (the server's first script posts the nonce
 * we were given) means it navigated while parsing. Either way the frame is REMOVED and replaced by a
 * notice with Reload, so a replacement page is never left on screen. The request the navigation made
 * cannot be recalled: the label and this notice are the mitigation, as the plan says.
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
    const [page, setPage] = useState<{
        url: string;
        nonce: string;
        rev: number;
        links: boolean;
    } | null>(null);
    const [navigated, setNavigated] = useState(false);
    // Bumped by every reload: refetch the page and remount the frame.
    const [nonce, setNonce] = useState(0);
    const [frameKey, setFrameKey] = useState(() => newNonce());

    const reload = useCallback(() => {
        setNavigated(false);
        setPhase("loading");
        setNonce((n) => n + 1);
    }, []);

    // Ask for the page's URL while this tab is the open one, once per Reload. The URL works for ONE
    // frame load (the API spends it), so leaving the tab, which removes the frame, also drops the URL:
    // coming back asks for a new one and shows the loading state meanwhile, never a frame that holds
    // a spent link. A request cut short by leaving the tab is not counted as done.
    const fetchedKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!isActive) {
            fetchedKeyRef.current = null;
            setPhase((p) => (p === "ready" ? "loading" : p));
            return;
        }
        const key = `${noteType}:${noteId}:${nonce}`;
        if (fetchedKeyRef.current === key) return;
        setPhase("loading");
        const controller = new AbortController();
        let cancelled = false;
        loadHtmlNoteFrame(noteType, noteId, accessToken, controller.signal)
            .then((loaded) => {
                if (cancelled) return;
                fetchedKeyRef.current = key;
                setPage({
                    url: loaded.url,
                    nonce: loaded.nonce,
                    rev: loaded.rev,
                    links: loaded.links,
                });
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
    const frameNonce = page?.nonce;
    const pageLinks = page?.links === true;
    const urlLinkModal = useUrlLinkModal();

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

    // The sentinel's message. Only a message from THIS frame carrying the nonce the API gave us for
    // this URL counts (a look-alike page only has the URL, never the nonce).
    useEffect(() => {
        if (!frameActive || !frameNonce) return;
        const onMessage = (event: MessageEvent) => {
            if (event.source !== frameRef.current?.contentWindow) return;
            const data = event.data as Record<string, unknown> | null;
            if (data && typeof data === "object" && data[HTML_NOTE_LOADED_KEY] === frameNonce) {
                confirmedRef.current = true;
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameActive, frameNonce]);

    // A link the member clicked in a server-drawn page: a preview of the task, milestone or note,
    // or the project's page, exactly as a link in a note's text opens it.
    useEffect(() => {
        if (!frameActive || !frameNonce || !pageLinks) return;
        const onOpen = (event: MessageEvent) => {
            const source = frameRef.current?.contentWindow;
            if (!source || event.source !== source) return;
            const data = event.data as Record<string, unknown> | null;
            if (!data || typeof data !== "object" || data.nonce !== frameNonce) return;
            const path = data[HTML_NOTE_OPEN_KEY];
            if (!isHtmlNotePageLink(path)) return;
            if (urlLinkModal) urlLinkModal.openModalByHref(path);
            else openAppUrl(path);
        };
        window.addEventListener("message", onOpen);
        return () => window.removeEventListener("message", onOpen);
    }, [frameActive, frameNonce, pageLinks, urlLinkModal]);

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
                    paddingX: TEXT_INSET,
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
                    paddingX: TEXT_INSET,
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
                            marginX: FRAME_INSET,
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
                            src={page?.url}
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
