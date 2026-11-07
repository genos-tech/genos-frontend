// The body of a Genos report card (inbox item_type 10): a headline, a one-line summary and
// sections of items, each item optionally a link.
//
// Plain text only. The text comes from a schedule's job, which reads other people's words,
// so nothing here is markdown or HTML. An in-app link goes through the URL-link modal (peek
// without losing the inbox), falling back to SPA navigation outside the provider: never a
// full-page load from a relative <a>. An https link opens in a new tab with the host shown.

import type { MouseEvent } from "react";
import { Box, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { focusRing, g, type } from "../../../theme/tokens";
import { ExternalLink } from "../../agentQA/agentMarkdown";
import {
    GenosReport,
    GenosReportItem,
    isInternalReportLink,
    parseGenosReport,
} from "../utils/genosReport";

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

export const GenosReportView = ({ report }: { report: GenosReport }) => (
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
);

/** The card body for an inbox item of type 10. Renders nothing for a body that is not a report. */
export const GenosReportBody = ({ itemBody }: { itemBody: unknown }) => {
    const report = parseGenosReport(itemBody);
    return report ? <GenosReportView report={report} /> : null;
};

export default GenosReportBody;
