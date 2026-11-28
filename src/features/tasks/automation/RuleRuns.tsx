/** What one rule did lately. */
import { useCallback, useEffect, useState } from "react";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import { Box } from "@mui/joy";

import { formatRelativeTime } from "../../../components/ui/dashboard/relativeTime";
import { EmptyState } from "../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../components/ui/feedback/Skeleton";
import { useAuth } from "../../../context/authState";
import { useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { parseServerTime } from "../utils/relativeAge";
import { listSx } from "./helpers";
import { useLookups } from "./lookups";
import { RuleSummary } from "./RuleSentence";
import { loadRuleRuns } from "./service";
import type { AutomationRule, RuleRun } from "./types";
import { reasonText, sentenceCase, useAutomationWords } from "./words";

const STATES = {
    applied: { Icon: CheckCircleOutlineRoundedIcon, color: g.success.text },
    refused: { Icon: BlockRoundedIcon, color: g.danger.text },
    skipped: { Icon: RemoveCircleOutlineRoundedIcon, color: g.text.tertiary },
} as const;

const fullTime = (value: string | null, locale: string): string | undefined => {
    const at = parseServerTime(value);
    return at == null
        ? undefined
        : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(at);
};

export const RuleRuns = ({ rule }: { rule: AutomationRule }) => {
    const words = useAutomationWords(rule.appliesTo);
    const { locale } = useTranslation();
    const { accessToken } = useAuth();
    const { projectId } = useLookups();
    const [runs, setRuns] = useState<RuleRun[] | "failed" | null>(null);

    const load = useCallback(() => {
        setRuns(null);
        void loadRuleRuns(projectId, rule.ruleId, accessToken).then((res) =>
            setRuns(res.ok ? res.data.runs : "failed")
        );
    }, [projectId, rule.ruleId, accessToken]);
    useEffect(load, [load]);

    const stateWord = {
        applied: words.stApplied,
        refused: words.stRefused,
        skipped: words.stSkipped,
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: g.radius.md, background: g.bg.subtle }}>
                <RuleSummary rule={rule} />
            </Box>
            {runs === null ? (
                <SkeletonRows count={3} label={words.recentRuns} />
            ) : runs === "failed" ? (
                <ErrorState size="sm" title={words.runsFailed} onRetry={load} />
            ) : runs.length === 0 ? (
                <EmptyState size="sm" title={words.runsEmpty} />
            ) : (
                <Box component="ul" sx={listSx}>
                    {runs.map((run) => {
                        const { Icon, color } = STATES[run.state] ?? STATES.skipped;
                        return (
                            <Box key={run.runId} component="li" sx={{ px: 1.25, py: 1 }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        component="bdi"
                                        sx={{
                                            ...type("body-sm"),
                                            fontVariantNumeric: "tabular-nums",
                                            color: run.displayId
                                                ? g.text.primary
                                                : g.text.secondary,
                                        }}
                                    >
                                        {run.displayId ?? words.hiddenTask}
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{ ...type("body-xs"), color: g.text.tertiary }}
                                        title={fullTime(run.tsDoneAt, locale)}
                                    >
                                        {formatRelativeTime(parseServerTime(run.tsDoneAt), locale)}
                                    </Box>
                                    <Box
                                        component="span"
                                        sx={{
                                            ...type("body-xs"),
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                            marginInlineStart: "auto",
                                            color,
                                        }}
                                    >
                                        <Icon sx={{ fontSize: 14, color: "inherit" }} />
                                        {stateWord[run.state] ?? run.state}
                                    </Box>
                                </Box>
                                {run.reason && (
                                    <Box
                                        sx={{
                                            ...type("body-xs"),
                                            color: g.text.secondary,
                                            mt: 0.5,
                                        }}
                                    >
                                        {sentenceCase(reasonText(words, run.reason))}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};
