// The body of a Genos report card (inbox item_type 10): a headline, a one-line summary and
// sections of items, each item optionally a link.
//
// Plain text only. The text comes from a schedule's job, which reads other people's words,
// so nothing here is markdown or HTML. An in-app link goes through the URL-link modal (peek
// without losing the inbox), falling back to SPA navigation outside the provider: never a
// full-page load from a relative <a>. An https link opens in a new tab with the host shown.

import { memo, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import { Box, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { focusRing, g, type } from "../../../theme/tokens";
import { ExternalLink } from "../../agentQA/agentMarkdown";
import { projectAvatarSrcMap } from "../../tasks/utils/projectAvatar";
import {
    GenosReport,
    GenosReportItem,
    isInternalReportLink,
    parseGenosReport,
} from "../utils/genosReport";
import { isReportV2, parseGenosReportV2, type GenosReportV2 } from "../utils/genosReportV2";
import {
    reportChatKeys,
    reportChatMarkMap,
    sameChatMarks,
    type ReportChatMark,
} from "../utils/reportChatMarks";
import { GenosReportCard } from "./GenosReportCard";

const itemLinkSx = {
    color: g.accent.text,
    textDecoration: "none",
    borderRadius: g.radius.xs,
    overflowWrap: "anywhere",
    "&:hover": { textDecoration: "underline" },
    "&:focus-visible": focusRing,
} as const;

const ReportItemRow = ({ item }: { item: GenosReportItem }) => {
    const urlLinkModal = useUrlLinkModal();
    const navigate = useNavigate();
    const { link, text } = item;

    if (link === null) return <>{text}</>;
    if (!isInternalReportLink(link)) {
        return (
            <Box component="span" sx={{ "& a": itemLinkSx }}>
                <ExternalLink href={link}>{text}</ExternalLink>
            </Box>
        );
    }
    return (
        <Box
            component="a"
            href={link}
            sx={itemLinkSx}
            onClick={(e: MouseEvent) => {
                // Let the browser keep its own "open in new tab" gestures.
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                if (urlLinkModal) {
                    urlLinkModal.openModalByHref(link);
                    return;
                }
                navigate(link);
            }}
        >
            {text}
        </Box>
    );
};

export const GenosReportView = memo(({ report }: { report: GenosReport }) => (
    <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box>
            {report.title !== "" && (
                <Typography
                    component="h3"
                    sx={{
                        ...type("title-sm"),
                        color: g.text.primary,
                        m: 0,
                        overflowWrap: "anywhere",
                    }}
                >
                    {report.title}
                </Typography>
            )}
            {report.summary !== "" && (
                <Typography
                    sx={{
                        ...type("body-sm"),
                        color: g.text.secondary,
                        mt: report.title !== "" ? 0.25 : 0,
                        overflowWrap: "anywhere",
                    }}
                >
                    {report.summary}
                </Typography>
            )}
        </Box>
        {report.sections.map((section, sectionIndex) => (
            <Box key={`${sectionIndex}-${section.heading}`} component="section">
                {section.heading !== "" && (
                    <Typography
                        component="h4"
                        sx={{
                            ...type("caption"),
                            color: g.text.tertiary,
                            m: 0,
                            mb: 0.5,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {section.heading}
                    </Typography>
                )}
                <Box
                    component="ul"
                    sx={{
                        m: 0,
                        pl: 2.25,
                        // The reset stylesheet removes bullets; without them a wrapped
                        // line reads as a new item.
                        listStyleType: "disc",
                        "& li::marker": { color: g.text.tertiary },
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        ...type("body-sm"),
                        color: g.text.primary,
                    }}
                >
                    {section.items.map((item, itemIndex) => (
                        <Box key={`${itemIndex}-${item.text}`} component="li" sx={{ pl: 0.25 }}>
                            <ReportItemRow item={item} />
                        </Box>
                    ))}
                </Box>
            </Box>
        ))}
    </Box>
));
GenosReportView.displayName = "GenosReportView";

type GenosReportBodyProps = {
    itemBody: unknown;
    /** The member's chats: the project marks of a typed report are read from them. */
    allChats?: Parameters<typeof projectAvatarSrcMap>[0];
    /** A typed report's footer slot (MIP-1209: AI usage and "Turn this off"). */
    footer?: ReactNode;
    /** The member and team a typed report's answers ("On it", "Not important") are for; without
     *  both the rows draw no buttons (MIP-1211). Plain strings, so the memoized card is not
     *  redrawn by a parent that re-renders. */
    userId?: string;
    teamId?: string;
};

const NO_AVATARS: ReadonlyMap<number, string> = new Map();

const sameMap = (a: ReadonlyMap<number, string>, b: ReadonlyMap<number, string>): boolean => {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (b.get(k) !== v) return false;
    return true;
};

/** The project pictures of a typed report, from the member's chats. The chat list is replaced
 *  on almost every message, so the map is handed on unchanged while its entries are, and the
 *  memoized card is not drawn again for a chat that has nothing to do with it. A report with
 *  no project line never scans the chats. */
const useProjectAvatars = (
    report: GenosReportV2 | null,
    allChats: GenosReportBodyProps["allChats"]
): ReadonlyMap<number, string> => {
    const last = useRef<ReadonlyMap<number, string>>(NO_AVATARS);
    return useMemo(() => {
        const hasProjects = report?.sections.some((s) => s.items.some((i) => i.project !== null));
        if (!hasProjects) return NO_AVATARS;
        const next = projectAvatarSrcMap(allChats);
        if (!sameMap(last.current, next)) last.current = next;
        return last.current;
    }, [report, allChats]);
};

const NO_CHAT_MARKS: ReadonlyMap<string, ReportChatMark> = new Map();

/** The chat avatars of a typed report's "Messages sent" lines (MIP-1333), from the member's
 *  chats. Same rule as the project pictures: the list is replaced on almost every message, so
 *  the map is handed on unchanged while its entries are, and a report with no chat line never
 *  scans the chats. */
const useChatMarks = (
    report: GenosReportV2 | null,
    allChats: GenosReportBodyProps["allChats"]
): ReadonlyMap<string, ReportChatMark> => {
    const last = useRef<ReadonlyMap<string, ReportChatMark>>(NO_CHAT_MARKS);
    // Which chats the report names depends on the report alone, not on the chat list.
    const keys = useMemo(() => reportChatKeys(report), [report]);
    return useMemo(() => {
        if (keys.size === 0) return NO_CHAT_MARKS;
        const next = reportChatMarkMap(keys, allChats);
        if (!sameChatMarks(last.current, next)) last.current = next;
        return last.current;
    }, [keys, allChats]);
};

/** The card body for an inbox item of type 10. A body with `version` 2 gets the rich card; one
 *  without it (a report stored before the typed fields) is drawn exactly as it always was.
 *  Renders nothing for a body that is not a report. The body is parsed once per body object and
 *  both cards are memoized, so an Inbox re-render that hands the same item costs nothing here. */
export const GenosReportBody = ({
    itemBody,
    allChats,
    footer,
    userId,
    teamId,
}: GenosReportBodyProps) => {
    // Parsed once per body object: `typed` for a version-2 body, `plain` for any other.
    const { typed, plain } = useMemo(
        () =>
            isReportV2(itemBody)
                ? { typed: parseGenosReportV2(itemBody), plain: null }
                : { typed: null, plain: parseGenosReport(itemBody) },
        [itemBody]
    );
    const avatars = useProjectAvatars(typed, allChats);
    const chatMarks = useChatMarks(typed, allChats);
    if (typed) {
        return (
            <GenosReportCard
                avatars={avatars}
                chatMarks={chatMarks}
                footer={footer}
                report={typed}
                teamId={teamId}
                userId={userId}
            />
        );
    }
    return plain ? <GenosReportView report={plain} /> : null;
};

export default GenosReportBody;
