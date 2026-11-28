/** The dry run: which of today's tasks the rule matches, and what it would do to each. */
import { useEffect, useRef } from "react";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import { Alert, Box } from "@mui/joy";

import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { fmt } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { StatusLabel } from "../components/meta/StatusLabel";
import type { RuleDraft } from "./draft";
import { listSx, ruleProblemOf } from "./helpers";
import { useLookups } from "./lookups";
import { RuleSentence } from "./RuleSentence";
import type { DryRunItem, DryRunResult } from "./types";
import { reasonText, sentenceCase, useAutomationWords } from "./words";

export type PreviewState =
    | { status: "loading" }
    | { status: "failed"; limited: boolean }
    | { status: "ok"; result: DryRunResult };

const OUTCOMES = {
    would_apply: { Icon: CheckCircleOutlineRoundedIcon, color: g.success.text },
    refused: { Icon: BlockRoundedIcon, color: g.danger.text },
    skipped: { Icon: RemoveCircleOutlineRoundedIcon, color: g.text.tertiary },
} as const;

const SentenceBox = ({
    draft,
    destinationName,
}: {
    draft: RuleDraft;
    destinationName?: string | null;
}) => (
    <Box sx={{ p: 1.5, borderRadius: g.radius.md, background: g.bg.subtle }}>
        <RuleSentence destinationName={destinationName} draft={draft} />
    </Box>
);

export const RulePreview = ({
    draft,
    state,
    onRetry,
    onAnnounce,
}: {
    draft: RuleDraft;
    state: PreviewState;
    onRetry: () => void;
    onAnnounce: (text: string) => void;
}) => {
    const words = useAutomationWords();
    const lookups = useLookups();
    const heading = useRef<HTMLHeadingElement>(null);
    const matched = state.status === "ok" ? state.result.matched : null;

    useEffect(() => {
        if (matched == null) return;
        heading.current?.focus();
        onAnnounce(fmt(words.matched, { matched }));
        // The announcement is for the answer arriving, not for a change of words.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matched]);

    const body = () => {
        if (state.status === "loading") return <SkeletonRows count={4} label={words.checking} />;
        if (state.status === "failed") {
            return (
                <ErrorState
                    size="sm"
                    title={state.limited ? words.previewLimited : words.previewFailed}
                    onRetry={onRetry}
                />
            );
        }
        const { result } = state;
        const problem = ruleProblemOf(result);
        const count = (outcome: DryRunItem["outcome"]) =>
            result.items.filter((i) => i.outcome === outcome).length;
        // The counts are of the rows shown, so they only speak for all when all are shown.
        const counts =
            result.items.length === result.matched
                ? ([
                      ["would_apply", words.nApply],
                      ["refused", words.nRefused],
                      ["skipped", words.nSkipped],
                  ] as const)
                : [];
        const outcomeWord = {
            would_apply: words.outApply,
            refused: words.outRefused,
            skipped: words.outSkipped,
        };
        return (
            <>
                <Box>
                    <Box
                        ref={heading}
                        component="h3"
                        sx={{ ...type("title-sm"), m: 0, "&:focus": { outline: "none" } }}
                        tabIndex={-1}
                    >
                        {fmt(words.matched, { matched: result.matched })}
                    </Box>
                    {result.matched > 0 && (
                        <Box sx={{ ...type("body-sm"), color: g.text.secondary, mt: 0.25 }}>
                            {words.matchedNote}
                        </Box>
                    )}
                </Box>
                {problem && (
                    <Alert color="danger" role="alert" size="sm" variant="soft">
                        {fmt(words.cantRun, { reason: reasonText(words, problem) })}
                    </Alert>
                )}
                {result.matched === 0 ? (
                    <EmptyState body={words.noneBody} size="sm" title={words.noneTitle} />
                ) : (
                    <>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                            {counts.map(([outcome, template]) =>
                                count(outcome) > 0 ? (
                                    <Box
                                        key={outcome}
                                        component="span"
                                        sx={{
                                            ...type("body-xs"),
                                            color: OUTCOMES[outcome].color,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {fmt(template, { n: count(outcome) })}
                                    </Box>
                                ) : null
                            )}
                        </Box>
                        <Box component="ul" data-testid="preview-rows" sx={listSx}>
                            {result.items.map((item) => {
                                const { Icon, color } = OUTCOMES[item.outcome];
                                return (
                                    <Box
                                        key={item.taskId}
                                        component="li"
                                        sx={{ px: 1.25, py: 1, minWidth: 0 }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexWrap: { xs: "wrap", sm: "nowrap" },
                                                alignItems: "center",
                                                columnGap: 1,
                                                rowGap: 0.5,
                                            }}
                                        >
                                            <Box
                                                component="bdi"
                                                sx={{
                                                    ...type("body-xs"),
                                                    color: g.text.tertiary,
                                                    fontVariantNumeric: "tabular-nums",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {item.displayId}
                                            </Box>
                                            <Box
                                                component="span"
                                                dir="auto"
                                                title={item.title}
                                                sx={{
                                                    ...type("body-sm"),
                                                    flex: { xs: "1 1 100%", sm: 1 },
                                                    order: { xs: 3, sm: 0 },
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {item.title}
                                            </Box>
                                            <StatusLabel
                                                projectId={lookups.projectId}
                                                status={item.status}
                                            />
                                            <Box
                                                component="span"
                                                sx={{
                                                    ...type("body-xs"),
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    color,
                                                    marginInlineStart: { xs: "auto", sm: 0 },
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                <Icon sx={{ fontSize: 14, color: "inherit" }} />
                                                {outcomeWord[item.outcome]}
                                            </Box>
                                        </Box>
                                        {item.reason && !problem && (
                                            <Box
                                                sx={{
                                                    ...type("body-xs"),
                                                    color: g.text.secondary,
                                                    mt: 0.5,
                                                }}
                                            >
                                                {sentenceCase(reasonText(words, item.reason))}
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </>
                )}
                {result.items.length < result.matched && (
                    <Box sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                        {fmt(words.shown, {
                            shown: result.items.length,
                            matched: result.matched,
                        })}
                    </Box>
                )}
                {result.truncated && (
                    <Box sx={{ ...type("body-xs"), color: g.text.tertiary }}>{words.scanCap}</Box>
                )}
            </>
        );
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
            <SentenceBox draft={draft} />
            {body()}
        </Box>
    );
};
