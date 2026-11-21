import { useState } from "react";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import { Box, Button, FormControl, FormLabel, Option, Select, Stack } from "@mui/joy";

import { ModalFrame } from "../../../../../components/ui/modal/ModalFrame";
import { useIsMobile } from "../../../../../hooks/common/useIsMobile";
import { useTranslation } from "../../../../../i18n";
import { fmt } from "../../../../../i18n/interpolate";
import { g } from "../../../../../theme/tokens";
import { AgentFilters, hasActiveAgentFilters } from "../../../agentActivity/agentActivityFilters";
import {
    AGENT_KINDS,
    AGENT_WORK_KINDS,
    AGENT_WORK_PERIODS,
    AgentKind,
    AgentWorkKind,
    AgentWorkPeriod,
} from "../../../services/loadAgentWork";

const ALL = "all";

type Props = {
    filters: AgentFilters;
    onChange: (next: AgentFilters) => void;
    onClear: () => void;
    projects: { id: number; name: string }[];
    people: { id: string; name: string }[];
};

/**
 * Filters for the Agent Activity tab (MIP-1613): period, project, agent, person and kind of
 * work. Inline on a desktop; on a phone they open in a full-screen sheet behind a Filters
 * button. Every control is a labelled Joy Select, so it keeps its label and focus ring.
 */
export const AgentFilterBar = ({ filters, onChange, onClear, projects, people }: Props) => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const isMobile = useIsMobile();
    const [sheetOpen, setSheetOpen] = useState(false);
    const active = hasActiveAgentFilters(filters) || filters.days !== 7;

    const controls = (
        <>
            <FormControl size="sm">
                <FormLabel>{a.period}</FormLabel>
                <Select
                    value={String(filters.days)}
                    onChange={(_, value) =>
                        value && onChange({ ...filters, days: Number(value) as AgentWorkPeriod })
                    }
                >
                    {AGENT_WORK_PERIODS.map((days) => (
                        <Option key={days} value={String(days)}>
                            {fmt(a.periodOption, { count: days })}
                        </Option>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="sm">
                <FormLabel>{a.project}</FormLabel>
                <Select
                    value={filters.projectId == null ? ALL : String(filters.projectId)}
                    onChange={(_, value) =>
                        onChange({
                            ...filters,
                            projectId: !value || value === ALL ? null : Number(value),
                        })
                    }
                >
                    <Option value={ALL}>{a.allProjects}</Option>
                    {projects.map((p) => (
                        <Option key={p.id} value={String(p.id)}>
                            {p.name}
                        </Option>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="sm">
                <FormLabel>{a.agent}</FormLabel>
                <Select
                    value={filters.agent ?? ALL}
                    onChange={(_, value) =>
                        onChange({
                            ...filters,
                            agent: !value || value === ALL ? null : (value as AgentKind),
                        })
                    }
                >
                    <Option value={ALL}>{a.allAgents}</Option>
                    {AGENT_KINDS.map((kind) => (
                        <Option key={kind} value={kind}>
                            {a.agents[kind]}
                        </Option>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="sm">
                <FormLabel>{a.person}</FormLabel>
                <Select
                    value={filters.userId ?? ALL}
                    onChange={(_, value) =>
                        onChange({
                            ...filters,
                            userId: !value || value === ALL ? null : value,
                        })
                    }
                >
                    <Option value={ALL}>{a.everyone}</Option>
                    {people.map((p) => (
                        <Option key={p.id} value={p.id}>
                            {p.name}
                        </Option>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="sm">
                <FormLabel>{a.kind}</FormLabel>
                <Select
                    value={filters.kind ?? ALL}
                    onChange={(_, value) =>
                        onChange({
                            ...filters,
                            kind: !value || value === ALL ? null : (value as AgentWorkKind),
                        })
                    }
                >
                    <Option value={ALL}>{a.allKinds}</Option>
                    {AGENT_WORK_KINDS.map((kind) => (
                        <Option key={kind} value={kind}>
                            {a.kinds[kind]}
                        </Option>
                    ))}
                </Select>
            </FormControl>
        </>
    );

    if (isMobile) {
        return (
            <Stack alignItems="center" direction="row" spacing={1} sx={{ minWidth: 0 }}>
                <Button
                    aria-haspopup="dialog"
                    color="neutral"
                    size="sm"
                    startDecorator={<FilterListRoundedIcon />}
                    sx={{ flex: "0 0 auto", minHeight: g.control.md }}
                    variant="outlined"
                    onClick={() => setSheetOpen(true)}
                >
                    {a.filtersLabel}
                </Button>
                {active && (
                    <Button color="neutral" size="sm" variant="plain" onClick={onClear}>
                        {a.clearFilters}
                    </Button>
                )}
                <ModalFrame
                    open={sheetOpen}
                    size="sm"
                    title={a.filtersLabel}
                    actions={
                        <Button fullWidth onClick={() => setSheetOpen(false)}>
                            {a.showResults}
                        </Button>
                    }
                    fullScreenOnMobile
                    onClose={() => setSheetOpen(false)}
                >
                    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                        {controls}
                        {active && (
                            <Button color="neutral" variant="plain" onClick={onClear}>
                                {a.clearFilters}
                            </Button>
                        )}
                    </Stack>
                </ModalFrame>
            </Stack>
        );
    }

    return (
        <Box
            aria-label={a.filtersLabel}
            role="group"
            sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                alignItems: "end",
                minWidth: 0,
            }}
        >
            {controls}
            {active && (
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ justifySelf: "start", minHeight: g.control.md }}
                    variant="plain"
                    onClick={onClear}
                >
                    {a.clearFilters}
                </Button>
            )}
        </Box>
    );
};
