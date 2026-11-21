import { Box, Button, Link, Stack, Typography } from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import { AgentWorkGroup, AgentWorkItem } from "../../../services/loadAgentWork";
import { agentTargetPath, formatAgentWhen } from "./agentActivityLinks";
import { AgentChip, FencedText } from "./agentActivityParts";

const TARGET_MARK = "{target}";

type Props = {
    groups: AgentWorkGroup[];
    hasMore: boolean;
    loadingMore: boolean;
    loadMoreFailed: boolean;
    onLoadMore: () => void;
};

/**
 * What the agents did, grouped by project, newest first (the server's order). Each row
 * names who or what made the change, says what it did, links to the target the app's
 * normal way, and quotes at most one fenced line of text.
 */
export const AgentProjectGroups = ({
    groups,
    hasMore,
    loadingMore,
    loadMoreFailed,
    onLoadMore,
}: Props) => {
    const { t, locale } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    return (
        <Stack spacing={2} sx={{ minWidth: 0 }}>
            {groups.map((group) => (
                <Box
                    key={group.project.id}
                    aria-labelledby={`agent-group-${group.project.id}`}
                    component="section"
                    sx={{ minWidth: 0 }}
                >
                    <Stack
                        alignItems="baseline"
                        direction="row"
                        justifyContent="space-between"
                        spacing={1}
                        sx={{ minWidth: 0, pb: 0.5, borderBottom: `1px solid ${g.border.subtle}` }}
                    >
                        <Typography
                            component="h3"
                            id={`agent-group-${group.project.id}`}
                            level="title-md"
                            sx={{ minWidth: 0 }}
                            noWrap
                        >
                            {group.project.name}
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{ color: g.text.secondary, flex: "0 0 auto" }}
                        >
                            {fmt(a.groups.changes, {
                                count: group.counts?.changes ?? group.items.length,
                            })}
                        </Typography>
                    </Stack>
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {group.items.map((item) => (
                            <AgentRow
                                key={item.id}
                                item={item}
                                locale={locale}
                                projectId={group.project.id}
                            />
                        ))}
                    </Box>
                </Box>
            ))}
            {hasMore && (
                <Stack alignItems="flex-start" spacing={1}>
                    <Button
                        color="neutral"
                        disabled={loadingMore}
                        loading={loadingMore}
                        size="sm"
                        variant="soft"
                        onClick={onLoadMore}
                    >
                        {loadingMore ? a.groups.loadingMore : a.groups.loadMore}
                    </Button>
                    {loadMoreFailed && (
                        <Typography level="body-xs" role="alert" sx={{ color: g.danger.text }}>
                            {a.groups.loadMoreFailed}
                        </Typography>
                    )}
                </Stack>
            )}
        </Stack>
    );
};

const AgentRow = ({
    item,
    projectId,
    locale,
}: {
    item: AgentWorkItem;
    projectId: number;
    locale: string;
}) => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const navigate = useNavigate();
    const template = a.actions[item.action as keyof typeof a.actions] ?? a.actions.other;
    const [before, after] = template.includes(TARGET_MARK)
        ? template.split(TARGET_MARK)
        : [template + " ", ""];
    const title = item.target?.title || a.untitled;
    const path = item.target ? agentTargetPath(item.target, projectId) : null;
    const when = formatAgentWhen(item.at, locale);

    return (
        <Box
            component="li"
            data-testid="agent-activity-row"
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "88px minmax(0, 1fr)" },
                gap: { xs: 0.25, md: 1.5 },
                py: 1,
                borderBottom: `1px solid ${g.border.subtle}`,
                minWidth: 0,
            }}
        >
            <Typography
                component="time"
                dateTime={item.at}
                level="body-xs"
                sx={{ color: g.text.secondary, pt: 0.25 }}
            >
                {when}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: "wrap", minWidth: 0 }}
                    useFlexGap
                >
                    <AgentChip
                        agent={item.agent}
                        label={a.agents[item.agent.kind] ?? a.agents.other_app}
                    />
                    {item.user && (
                        <Typography
                            level="body-sm"
                            sx={{ fontWeight: 600, color: g.text.primary }}
                        >
                            {item.user.name}
                        </Typography>
                    )}
                </Stack>
                <Typography
                    component="p"
                    level="body-sm"
                    sx={{ color: g.text.primary, mt: 0.5, mb: 0, overflowWrap: "anywhere" }}
                >
                    {before}
                    {path ? (
                        <Link
                            aria-label={fmt(a.openTarget, { title })}
                            component="button"
                            level="body-sm"
                            sx={{ fontWeight: 600, textAlign: "left" }}
                            type="button"
                            onClick={() => navigate(path)}
                        >
                            {title}
                        </Link>
                    ) : (
                        <Box component="span" sx={{ fontWeight: 600 }}>
                            {title}
                        </Box>
                    )}
                    {after}
                </Typography>
                {item.text && <FencedText>{item.text}</FencedText>}
            </Box>
        </Box>
    );
};
