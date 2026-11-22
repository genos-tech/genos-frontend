import { useMemo, useState } from "react";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {
    Autocomplete,
    Box,
    Button,
    FormControl,
    FormLabel,
    Option,
    Select,
    Stack,
} from "@mui/joy";

import {
    MODAL_FRAME_DEFAULT_Z_INDEX,
    ModalFrame,
} from "../../../../../components/ui/modal/ModalFrame";
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
import {
    isSameMember,
    memberOptionLabel,
    renderMemberOption,
} from "../../autocompletes/MemberPickerParts";
import {
    isSameProject,
    projectListboxSlotProps,
    projectOptionLabel,
    renderProjectOption,
} from "../../autocompletes/ProjectPickerParts";
import { ProjectIdentityDecorator, type ProjectIdentity } from "../../ProjectIdentityRow";

const ALL = "all";

type Props = {
    filters: AgentFilters;
    onChange: (next: AgentFilters) => void;
    onClear: () => void;
    projects: { id: number; name: string }[];
    /** Full records for the Project options (labels, lock, share mark). Optional. */
    projectRecords?: readonly ProjectIdentity[];
    /** Project id -> avatar url; a project missing from it gets the generic icon. */
    projectAvatars?: Map<number, string>;
    people: { id: string; name: string }[];
};

/**
 * Filters for the Agent Activity tab (MIP-1613): period, project, agent, person and kind of
 * work. Inline on a desktop; on a phone they open in a full-screen sheet behind a Filters
 * button. Period, agent and kind are labelled Joy Selects; Project and Person are the same Autocompletes as the other project and member pickers (MIP-1916).
 */
export const AgentFilterBar = ({
    filters,
    onChange,
    onClear,
    projects,
    projectRecords,
    projectAvatars,
    people,
}: Props) => {
    const { t } = useTranslation();
    const a = t.tasks.dashboard.agentActivity;
    const isMobile = useIsMobile();
    const [sheetOpen, setSheetOpen] = useState(false);
    // The lists portal to <body>. In the phone sheet (a ModalFrame at its own high layer) they
    // must sit above it; inline on a desktop the page's layer is enough.
    const popupZIndex = isMobile ? MODAL_FRAME_DEFAULT_Z_INDEX + 10 : 1301;
    const active = hasActiveAgentFilters(filters) || filters.days !== 7;
    // The Project filter is the same Autocomplete as the other project pickers (MIP-1916): the
    // identity row (avatar, labels, lock) when the full record is known, the name alone if not.
    const projectOptions = useMemo<ProjectIdentity[]>(
        () =>
            projects.map(
                (p) =>
                    projectRecords?.find((r) => r.projectId === p.id) ?? {
                        projectId: p.id,
                        projectName: p.name,
                    }
            ),
        [projects, projectRecords]
    );
    const selectedProject = projectOptions.find((p) => p.projectId === filters.projectId) ?? null;
    const selectedPerson = people.find((p) => p.id === filters.userId) ?? null;

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
                <Autocomplete
                    getOptionLabel={projectOptionLabel}
                    isOptionEqualToValue={isSameProject}
                    options={projectOptions}
                    placeholder={a.allProjects}
                    renderOption={renderProjectOption(projectAvatars)}
                    size="sm"
                    slotProps={projectListboxSlotProps(popupZIndex)}
                    value={selectedProject}
                    // Omitted while empty: Joy still lays out the decorator's gap around nothing.
                    startDecorator={
                        selectedProject ? (
                            <ProjectIdentityDecorator
                                avatarSrc={projectAvatars?.get(selectedProject.projectId)}
                                project={selectedProject}
                            />
                        ) : undefined
                    }
                    onChange={(_, value) =>
                        onChange({ ...filters, projectId: value ? value.projectId : null })
                    }
                />
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
                <Autocomplete
                    getOptionLabel={memberOptionLabel}
                    isOptionEqualToValue={isSameMember}
                    options={people}
                    placeholder={a.everyone}
                    renderOption={renderMemberOption()}
                    size="sm"
                    slotProps={projectListboxSlotProps(popupZIndex)}
                    startDecorator={<PersonRoundedIcon sx={{ fontSize: 16 }} />}
                    value={selectedPerson}
                    onChange={(_, value) =>
                        onChange({ ...filters, userId: value ? value.id : null })
                    }
                />
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
