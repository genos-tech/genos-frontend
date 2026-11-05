import { ReactNode, useMemo } from "react";
import { Link } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useUrlLinkModal } from "../../../../hooks/common/UrlLinkModalContext";
import {
    resolveTitleMentions,
    TitleMentionChip,
    useTodoMentionPool,
    type ResolvedTitleMention,
} from "./titleMentions";

// Two link forms are recognized inside the otherwise-plain title:
//   * Markdown links — [label](https://…) → the *label* becomes clickable.
//   * Bare http(s) URLs — https://… → the URL itself becomes clickable.
// The title is still stored verbatim as plain text (the raw "[label](url)"
// markdown included); this only changes how it's drawn in the row's read
// state, and edit mode shows the raw text back so links stay editable.
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s]+)/g;

// Only http(s) links are allowed through, so a "[x](javascript:…)" stays inert
// plain text — building <Link> elements here then carries no injection risk.
const isSafeHref = (url: string): boolean => /^https?:\/\//i.test(url);

// One decorated stretch of the title — a link or a mention chip. Both are
// collected as [start, end) spans first so the two passes can't produce
// overlapping output (see the overlap skip below).
interface TitleSpan {
    start: number;
    end: number;
    node: ReactNode;
}

export const renderTitleWithLinks = (
    text: string,
    // Provided when the row renders inside the app's UrlLinkModalProvider
    // (null on e.g. signin surfaces). When present, internal links open in
    // the preview modal / react-router instead of a new tab; null falls back
    // to the plain target="_blank" anchor below.
    urlLinkModal: ReturnType<typeof useUrlLinkModal>,
    // `@`/`#` tokens that still resolve against the mention pool. Empty on
    // any title without one, which is nearly all of them.
    mentions: ResolvedTitleMention[],
    myselfUserId: string | undefined,
    isDark: boolean
): ReactNode => {
    const spans: TitleSpan[] = [];
    for (const match of text.matchAll(LINK_RE)) {
        const [whole, mdLabel, mdUrl, bareUrl] = match;
        const start = match.index;

        let label: string;
        let href: string;
        let consumed: number;
        if (mdUrl !== undefined) {
            // Unsafe markdown href: leave the whole "[label](url)" as text.
            if (!isSafeHref(mdUrl)) continue;
            href = mdUrl;
            label = mdLabel;
            consumed = whole.length;
        } else {
            // Bare URL: don't swallow trailing sentence punctuation
            // (e.g. "see https://x.com." or a URL wrapped in parens).
            href = bareUrl.replace(/[.,;:!?)\]}'"]+$/, "");
            label = href;
            consumed = href.length;
        }

        spans.push({
            start,
            end: start + consumed,
            // stopPropagation: opening the link must not also flip the row
            // into edit mode. When the modal provider is present, route the
            // click through openModalByHref — it self-terminates (opens the
            // preview modal for internal entities, navigates internal routes,
            // window.opens externals), so preventDefault cancels the native
            // anchor and lets it own the click. With no provider, fall
            // through to the plain target="_blank" anchor.
            node: (
                <Link
                    key={`l${start}`}
                    href={href}
                    rel="noopener noreferrer"
                    sx={{ fontSize: "inherit", color: "primary.500" }}
                    target="_blank"
                    underline="always"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (urlLinkModal) {
                            e.preventDefault();
                            urlLinkModal.openModalByHref(href);
                        }
                    }}
                >
                    {label}
                </Link>
            ),
        });
    }

    for (const m of mentions) {
        // A link wins: a "#tag" sitting inside a markdown label or a URL
        // path is part of that link, not a mention of its own.
        if (spans.some((s) => m.start < s.end && s.start < m.end)) continue;
        spans.push({
            start: m.start,
            end: m.end,
            node: (
                <TitleMentionChip
                    key={`m${m.start}`}
                    isDark={isDark}
                    mention={m}
                    myselfUserId={myselfUserId}
                    text={text.slice(m.start, m.end)}
                    onOpenHref={(href) => urlLinkModal?.openModalByHref(href)}
                />
            ),
        });
    }

    // Mentions were appended after the links, so a sort is what puts the
    // two kinds back into reading order.
    spans.sort((a, b) => a.start - b.start);

    const out: ReactNode[] = [];
    let lastIndex = 0;
    for (const s of spans) {
        if (s.start > lastIndex) out.push(text.slice(lastIndex, s.start));
        out.push(s.node);
        lastIndex = s.end;
    }
    if (lastIndex < text.length) out.push(text.slice(lastIndex));
    return out;
};

/**
 * A saved to-do title as it reads: links clickable, `@` / `#` tokens as chips.
 * What a to-do row prints, now shared so a scheduled to-do's row prints its
 * title the same way (MIP-1047). Needs the to-do mention pool above it.
 */
export const TodoTitleText = ({ text, myselfUserId }: { text: string; myselfUserId?: string }) => {
    const urlLinkModal = useUrlLinkModal();
    const pool = useTodoMentionPool();
    const { mode } = useColorScheme();
    const mentions = useMemo(() => resolveTitleMentions(text, pool), [text, pool]);
    return (
        <>{renderTitleWithLinks(text, urlLinkModal, mentions, myselfUserId, mode === "dark")}</>
    );
};
