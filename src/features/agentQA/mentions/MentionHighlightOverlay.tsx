// Marker-style highlight for live mention tokens inside a plain
// <textarea> or <input>. Neither can style substrings, so this renders an
// absolutely-positioned, pointer-transparent mirror of the text exactly
// over the element: every character is drawn transparent (so layout —
// wrapping, spacing — matches 1:1) and the mention ranges get a
// translucent rounded background, reading like a highlighter pass over
// the user's own text.
//
// Geometry is measured from the LIVE element (getBoundingClientRect +
// getComputedStyle) rather than duplicated in sx, so the same component
// overlays the borderless Spotlight textarea, MUI Joy's padded
// <Textarea>, and the to-do title <Input> without hardcoding any one's
// metrics. Re-measures on value changes (autosize), element resize, and
// mirrors the element's own scrolling.
//
// `singleLine` switches to <input> geometry: text never wraps, it scrolls
// HORIZONTALLY once it outgrows the box, and the browser centers the one
// line vertically in the content box (a block mirror would top-align it).

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
    /** The mirrored field — a <textarea>, or an <input> with `singleLine`. */
    elementRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
    value: string;
    ranges: MentionTokenMatch[];
    isDark?: boolean;
    /** Mirror an <input>: no wrapping, horizontal scroll, centered line. */
    singleLine?: boolean;
}

export const MentionHighlightOverlay = ({
    containerRef,
    elementRef,
    value,
    ranges,
    isDark = false,
    singleLine = false,
}: Props) => {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [box, setBox] = useState<OverlayBox | null>(null);
    const [typo, setTypo] = useState<CSSProperties>({});

    const measure = useCallback(() => {
        const ta = elementRef.current;
        const container = containerRef.current;
        if (!ta || !container) return;
        const taRect = ta.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        // clientLeft/Top skip the border; clientWidth/Height give the
        // padding box (minus any scrollbar), which is where text lays out.
        // Equality-guarded: this runs per keystroke (the effect below
        // keys on `value` because the Spotlight textarea autosizes), and
        // an unconditional fresh-object setState would force a second
        // render pass on every character even when nothing moved.
        const nextBox: OverlayBox = {
            top: taRect.top - cRect.top + ta.clientTop,
            left: taRect.left - cRect.left + ta.clientLeft,
            width: ta.clientWidth,
            height: ta.clientHeight,
        };
        setBox((prev) =>
            prev &&
            prev.top === nextBox.top &&
            prev.left === nextBox.left &&
            prev.width === nextBox.width &&
            prev.height === nextBox.height
                ? prev
                : nextBox
        );
        const cs = window.getComputedStyle(ta);
        const nextTypo: CSSProperties = {
            font: cs.font,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            textAlign: cs.textAlign as CSSProperties["textAlign"],
            paddingTop: cs.paddingTop,
            paddingRight: cs.paddingRight,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
        };
        setTypo((prev) =>
            (Object.keys(nextTypo) as Array<keyof CSSProperties>).every(
                (k) => prev[k] === nextTypo[k]
            )
                ? prev
                : nextTypo
        );
    }, [containerRef, elementRef]);

    // Re-measure synchronously whenever the mirrored text changes (the
    // Spotlight textarea autosizes per keystroke) and track any other
    // size changes via ResizeObserver.
    useLayoutEffect(() => {
        measure();
    }, [measure, value]);

    useEffect(() => {
        const ta = elementRef.current;
        if (!ta || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(ta);
        return () => ro.disconnect();
    }, [measure, elementRef]);

    // Mirror internal scrolling — a textarea past its max height scrolls
    // vertically; an <input> scrolls horizontally to keep the caret
    // visible, which happens as the user TYPES (not only on a scroll
    // event), hence the re-sync keyed on `value` as well.
    useEffect(() => {
        const ta = elementRef.current;
        if (!ta) return;
        const sync = () => {
            const el = overlayRef.current;
            if (!el) return;
            el.scrollTop = ta.scrollTop;
            el.scrollLeft = ta.scrollLeft;
        };
        sync();
        ta.addEventListener("scroll", sync);
        return () => ta.removeEventListener("scroll", sync);
    }, [elementRef, value]);

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

    const spans = segments.map((s) =>
        s.mention ? (
            <span
                key={s.key}
                data-testid="mention-highlight-token"
                style={{
                    backgroundColor: highlight,
                    borderRadius: 3,
                    // Keep the pill look on tokens that wrap across lines.
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                }}
            >
                {s.text}
            </span>
        ) : (
            <span key={s.key}>{s.text}</span>
        )
    );

    return (
        <div
            ref={overlayRef}
            aria-hidden
            data-testid="mention-highlight-overlay"
            style={{
                position: "absolute",
                overflow: "hidden",
                pointerEvents: "none",
                whiteSpace: singleLine ? "pre" : "pre-wrap",
                overflowWrap: singleLine ? "normal" : "break-word",
                color: "transparent",
                zIndex: 1,
                boxSizing: "border-box",
                // An <input> centers its single line of text in the content
                // box; a block mirror would top-align it.
                ...(singleLine ? { display: "flex", alignItems: "center" } : null),
                ...box,
                ...typo,
            }}
        >
            {/* One un-shrinkable child so the flex row above can't compress
                the text away from the input's own metrics, and so
                `scrollLeft` has something wider than the box to scroll. */}
            {singleLine ? <span style={{ flexShrink: 0 }}>{spans}</span> : spans}
        </div>
    );
};
