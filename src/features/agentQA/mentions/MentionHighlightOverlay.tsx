// Marker-style highlight for live mention tokens inside a plain
// textarea. A textarea can't style substrings, so this renders an
// absolutely-positioned, pointer-transparent mirror of the text exactly
// over the textarea: every character is drawn transparent (so layout —
// wrapping, spacing — matches 1:1) and the mention ranges get a
// translucent rounded background, reading like a highlighter pass over
// the user's own text.
//
// Geometry is measured from the LIVE textarea (getBoundingClientRect +
// getComputedStyle) rather than duplicated in sx, so the same component
// overlays both the borderless Spotlight textarea and MUI Joy's padded
// <Textarea> without hardcoding either one's metrics. Re-measures on
// value changes (autosize), element resize, and mirrors scrollTop.

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";

import type { MentionTokenMatch } from "./useAgentMentionDraft";

// Purple-tinted marker, tuned for legibility of the text underneath on
// both the light surfaces and Spotlight's translucent dark sheet.
const HIGHLIGHT_LIGHT = "rgba(124, 77, 255, 0.20)";
const HIGHLIGHT_DARK = "rgba(180, 155, 255, 0.30)";

interface OverlayBox {
    top: number;
    left: number;
    width: number;
    height: number;
}

interface Props {
    /** The `position: relative` ancestor this overlay is rendered into. */
    containerRef: RefObject<HTMLElement | null>;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    value: string;
    ranges: MentionTokenMatch[];
    isDark?: boolean;
}

export const MentionHighlightOverlay = ({
    containerRef,
    textareaRef,
    value,
    ranges,
    isDark = false,
}: Props) => {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [box, setBox] = useState<OverlayBox | null>(null);
    const [typo, setTypo] = useState<CSSProperties>({});

    const measure = useCallback(() => {
        const ta = textareaRef.current;
        const container = containerRef.current;
        if (!ta || !container) return;
        const taRect = ta.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        // clientLeft/Top skip the border; clientWidth/Height give the
        // padding box (minus any scrollbar), which is where text lays out.
        setBox({
            top: taRect.top - cRect.top + ta.clientTop,
            left: taRect.left - cRect.left + ta.clientLeft,
            width: ta.clientWidth,
            height: ta.clientHeight,
        });
        const cs = window.getComputedStyle(ta);
        setTypo({
            font: cs.font,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            textAlign: cs.textAlign as CSSProperties["textAlign"],
            paddingTop: cs.paddingTop,
            paddingRight: cs.paddingRight,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
        });
    }, [containerRef, textareaRef]);

    // Re-measure synchronously whenever the mirrored text changes (the
    // Spotlight textarea autosizes per keystroke) and track any other
    // size changes via ResizeObserver.
    useLayoutEffect(() => {
        measure();
    }, [measure, value]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(ta);
        return () => ro.disconnect();
    }, [measure, textareaRef]);

    // Mirror internal scrolling (textarea past its max height).
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const sync = () => {
            const el = overlayRef.current;
            if (el) el.scrollTop = ta.scrollTop;
        };
        sync();
        ta.addEventListener("scroll", sync);
        return () => ta.removeEventListener("scroll", sync);
    }, [textareaRef, value]);

    if (!box || ranges.length === 0) return null;

    const highlight = isDark ? HIGHLIGHT_DARK : HIGHLIGHT_LIGHT;
    const segments: Array<{ text: string; mention: boolean; key: string }> = [];
    let cursor = 0;
    for (const r of ranges) {
        if (r.start > cursor) {
            segments.push({
                text: value.slice(cursor, r.start),
                mention: false,
                key: `t${cursor}`,
            });
        }
        segments.push({ text: value.slice(r.start, r.end), mention: true, key: `m${r.start}` });
        cursor = r.end;
    }
    if (cursor < value.length) {
        segments.push({ text: value.slice(cursor), mention: false, key: `t${cursor}` });
    }

    return (
        <div
            ref={overlayRef}
            aria-hidden
            data-testid="mention-highlight-overlay"
            style={{
                position: "absolute",
                overflow: "hidden",
                pointerEvents: "none",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                color: "transparent",
                zIndex: 1,
                boxSizing: "border-box",
                ...box,
                ...typo,
            }}
        >
            {segments.map((s) =>
                s.mention ? (
                    <span
                        key={s.key}
                        data-testid="mention-highlight-token"
                        style={{
                            backgroundColor: highlight,
                            borderRadius: 3,
                            // Keep the pill look on tokens that wrap
                            // across lines.
                            boxDecorationBreak: "clone",
                            WebkitBoxDecorationBreak: "clone",
                        }}
                    >
                        {s.text}
                    </span>
                ) : (
                    <span key={s.key}>{s.text}</span>
                )
            )}
        </div>
    );
};
