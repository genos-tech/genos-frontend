import React, { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Option,
    Select,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TagListProps } from "../../../../types/tasks";
import { getFormattedNDaysAfterDateStr } from "../../../../utils/dateUtils";
import { loadProjectTags } from "../../services/loadProjectTags";
import { saveProjectTaskFieldRules } from "../../services/projectTaskFieldRules";
import { ConfigurableTaskField, TaskFieldRule, TaskFieldRules } from "../../utils/taskFieldRules";
import { effortLevels, priorities, statuses } from "../../utils/taskMeta";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useTM: TaskManagementState;
    open: boolean;
    onClose: () => void;
};

// Drop entries that neither require the field nor default it — keeps the
// stored blob minimal and makes "everything off" round-trip as {}.
const pruneRules = (rules: TaskFieldRules): TaskFieldRules => {
    const pruned: TaskFieldRules = {};
    (Object.keys(rules) as ConfigurableTaskField[]).forEach((field) => {
        const cfg = rules[field];
        if (!cfg) return;
        const hasDefault =
            (cfg.default != null && cfg.default !== "") ||
            cfg.defaultOffsetDays != null ||
            (cfg.defaultTagNames != null && cfg.defaultTagNames.length > 0);
        if (!cfg.required && !hasDefault) return;
        pruned[field] = cfg;
    });
    return pruned;
};

/**
 * Owner-only settings modal: per-project rules making task/milestone
 * metadata fields required at creation and/or pre-filled with defaults.
 * Saves the whole blob via PUT (server enforces the owner gate) and
 * writes the response straight back into `useTM.taskFieldRules`.
 */
export const ModalCustomizeTaskFields: React.FC<Props> = ({
    myself,
    usePM,
    useTEM,
    useTM,
    open,
    onClose,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const tc = t.tasks.modals.customizeFields;

    const projectId = usePM.currentProject?.projectId;

    const [rules, setRules] = useState<TaskFieldRules>({});
    // Fetched fresh on open — `currentProject.projectTags` can be stale
    // (ACTeamProjects clears it to [] on a project switch).
    const [projectTags, setProjectTags] = useState<TagListProps[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setErrorMessage(null);
        setRules(useTM.taskFieldRules?.rules ?? {});
        if (projectId && accessToken) {
            (async () => {
                const tags = await loadProjectTags(myself, projectId, accessToken);
                setProjectTags(Array.isArray(tags) ? tags : []);
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const patchRule = (field: ConfigurableTaskField, patch: Partial<TaskFieldRule>) => {
        setRules((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
    };

    const handleSave = async () => {
        if (!projectId) return;
        setIsSaving(true);
        setErrorMessage(null);
        const saved = await saveProjectTaskFieldRules(projectId, pruneRules(rules), accessToken);
        setIsSaving(false);
        if (saved) {
            useTM.setTaskFieldRules(saved);
            onClose();
        } else {
            setErrorMessage(tc.saveFailed);
        }
    };

    const labelSx = { color: "rgba(255,255,255,0.85)", fontWeight: 600 };
    const hintSx = { color: "rgba(255,255,255,0.45)", fontStyle: "italic" };
    const controlSx = {
        "--Select-minHeight": "32px",
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        color: "#e0e0e0",
    };

    const requiredSwitch = (field: ConfigurableTaskField, disabled = false) => (
        <Switch
            checked={rules[field]?.required === true}
            disabled={disabled}
            size="sm"
            onChange={(e) => patchRule(field, { required: e.target.checked })}
        />
    );

    const vocabChip = (label: string | null, color: string | null, textColor: string | null) => (
        <Chip
            size="sm"
            sx={{
                backgroundColor: color ?? "#888",
                color: textColor ?? "white",
                borderRadius: "5px",
                fontWeight: "bold",
            }}
        >
            {label}
        </Chip>
    );

    // One grid row: label | required control | default control.
    const row = (label: string, required: React.ReactNode, defaultControl: React.ReactNode) => (
        <Box
            key={label}
            sx={{
                display: "grid",
                gridTemplateColumns: "130px 84px 1fr",
                alignItems: "center",
                gap: 1,
                py: 0.75,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <Typography level="body-sm" sx={labelSx}>
                {label}
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "center" }}>{required}</Box>
            <Box sx={{ minWidth: 0 }}>{defaultControl}</Box>
        </Box>
    );

    const dueOffset = rules.dueDate?.defaultOffsetDays ?? null;

    return (
        <Modal
            open={open}
            sx={{
                backdropFilter: "blur(4px)",
                // Joy's own Backdrop slot already paints the backdrop.
                backgroundColor: "transparent",
            }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124,58,237,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "640px" },
                    maxWidth: { xs: "100vw", md: "760px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "88vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                }}
            >
                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 40,
                            height: 40,
                            borderRadius: "10px",
                            background:
                                "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                            border: "1px solid rgba(124,58,237,0.3)",
                        }}
                    >
                        <TuneRoundedIcon sx={{ color: "rgba(139, 92, 246, 0.9)", fontSize: 22 }} />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                            flex: 1,
                        }}
                    >
                        {tc.heading}
                    </Typography>
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={{
                            color: "rgba(255,255,255,0.5)",
                            "&:hover": { color: "rgba(255,255,255,0.9)" },
                        }}
                        onClick={onClose}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                <Typography level="body-xs" sx={{ color: "rgba(255,255,255,0.55)", mb: 2 }}>
                    {tc.description}
                </Typography>

                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Grid header + rows. A real element, not a fragment:
                    ModalDialog injects `data-last-child` into its direct
                    children, which a React.Fragment can't accept. */}
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "130px 84px 1fr",
                            gap: 1,
                            pb: 0.5,
                            borderBottom: "1px solid rgba(255,255,255,0.12)",
                        }}
                    >
                        <span />
                        <Typography
                            level="body-xs"
                            sx={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}
                        >
                            {tc.requiredLabel}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: "rgba(255,255,255,0.5)" }}>
                            {tc.defaultLabel}
                        </Typography>
                    </Box>

                    {/* Project — always required, nothing to configure. */}
                    {row(
                        t.tasks.fields.project,
                        <LockOutlinedIcon sx={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }} />,
                        <Typography level="body-xs" sx={hintSx}>
                            {tc.alwaysRequired}
                        </Typography>
                    )}

                    {/* Due date — offset default ("today + N"). */}
                    {row(
                        t.tasks.fields.dueDate,
                        requiredSwitch("dueDate"),
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography level="body-sm" sx={{ color: "rgba(255,255,255,0.7)" }}>
                                {tc.dueOffsetPrefix}
                            </Typography>
                            <Input
                                size="sm"
                                sx={{ ...controlSx, width: "84px" }}
                                type="number"
                                value={dueOffset ?? ""}
                                slotProps={{
                                    input: { min: 0, max: 3650, "aria-label": tc.dueOffsetLabel },
                                }}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsed = raw === "" ? null : Number(raw);
                                    patchRule("dueDate", {
                                        defaultOffsetDays:
                                            parsed == null ||
                                            !Number.isInteger(parsed) ||
                                            parsed < 0
                                                ? null
                                                : Math.min(parsed, 3650),
                                    });
                                }}
                            />
                            <Typography level="body-sm" sx={{ color: "rgba(255,255,255,0.7)" }}>
                                {tc.dueOffsetSuffix}
                            </Typography>
                            {dueOffset != null && (
                                <Typography level="body-xs" sx={hintSx}>
                                    → {getFormattedNDaysAfterDateStr(dueOffset)}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {/* Status — default-only: the create form hides status
                        and always seeds "Open", so a Required toggle here
                        could never actually block a create. */}
                    {row(
                        t.tasks.fields.status,
                        <AppTooltip title={tc.autoSetHint}>
                            <Typography level="body-xs" sx={hintSx}>
                                {tc.autoSetShort}
                            </Typography>
                        </AppTooltip>,
                        <Select
                            placeholder={tc.noneOption}
                            size="sm"
                            sx={controlSx}
                            value={rules.status?.default ?? null}
                            onChange={(_, value) => patchRule("status", { default: value })}
                        >
                            <Option value={null}>{tc.noneOption}</Option>
                            {statuses
                                .filter((s) => s.status !== "Deleted")
                                .map((s) => (
                                    <Option key={s.status ?? ""} value={s.status ?? ""}>
                                        {vocabChip(s.status, s.color, s.textColor)}
                                    </Option>
                                ))}
                        </Select>
                    )}

                    {/* Priority */}
                    {row(
                        t.tasks.fields.priority,
                        requiredSwitch("priority"),
                        <Select
                            placeholder={tc.noneOption}
                            size="sm"
                            sx={controlSx}
                            value={rules.priority?.default ?? null}
                            onChange={(_, value) => patchRule("priority", { default: value })}
                        >
                            <Option value={null}>{tc.noneOption}</Option>
                            {priorities.map((p) => (
                                <Option key={p.priority ?? ""} value={p.priority ?? ""}>
                                    {vocabChip(p.priority, p.color, p.textColor)}
                                </Option>
                            ))}
                        </Select>
                    )}

                    {/* Effort level */}
                    {row(
                        t.tasks.fields.effortLevel,
                        requiredSwitch("effortLevel"),
                        <Select
                            placeholder={tc.noneOption}
                            size="sm"
                            sx={controlSx}
                            value={rules.effortLevel?.default ?? null}
                            onChange={(_, value) => patchRule("effortLevel", { default: value })}
                        >
                            <Option value={null}>{tc.noneOption}</Option>
                            {effortLevels.map((e) => (
                                <Option key={e.level ?? ""} value={e.level ?? ""}>
                                    {vocabChip(e.level, e.color, e.textColor)}
                                </Option>
                            ))}
                        </Select>
                    )}

                    {/* Tags — "a field with no options can't be required". */}
                    {row(
                        t.tasks.fields.tags,
                        projectTags.length === 0 ? (
                            <AppTooltip title={tc.noTagsHint}>
                                <span>{requiredSwitch("tags", true)}</span>
                            </AppTooltip>
                        ) : (
                            requiredSwitch("tags")
                        ),
                        <Autocomplete
                            getOptionLabel={(tag: TagListProps) => tag.tagName}
                            isOptionEqualToValue={(a, b) => a.tagName === b.tagName}
                            options={projectTags}
                            placeholder={tc.noneOption}
                            size="sm"
                            sx={controlSx}
                            renderTags={(tags, getTagProps) =>
                                tags.map((tag, index) => {
                                    // React 19 warns when a spread object
                                    // carries `key` — pull it out first.
                                    const { key, ...tagProps } = getTagProps({ index });
                                    return (
                                        <Chip
                                            key={key ?? tag.tagName}
                                            {...tagProps}
                                            size="sm"
                                            sx={{
                                                backgroundColor: tag.tagColor,
                                                color: tag.tagTextColor,
                                                borderRadius: "5px",
                                                fontWeight: "bold",
                                                mr: 0.5,
                                            }}
                                        >
                                            {tag.tagName}
                                        </Chip>
                                    );
                                })
                            }
                            value={(rules.tags?.defaultTagNames ?? [])
                                .map((name) => projectTags.find((tag) => tag.tagName === name))
                                .filter((tag): tag is TagListProps => tag != null)}
                            multiple
                            onChange={(_, value) =>
                                patchRule("tags", {
                                    defaultTagNames: value.map((tag) => tag.tagName),
                                })
                            }
                        />
                    )}

                    {/* Assignee */}
                    {row(
                        t.tasks.fields.assignee,
                        requiredSwitch("assignee"),
                        <Select
                            placeholder={tc.noneOption}
                            size="sm"
                            sx={controlSx}
                            value={rules.assignee?.default ?? null}
                            onChange={(_, value) => patchRule("assignee", { default: value })}
                        >
                            <Option value={null}>{tc.noneOption}</Option>
                            <Option value="creator">{tc.creatorOption}</Option>
                            {useTEM.teamMembers.map((member) => (
                                <Option key={member.userId} value={member.userId}>
                                    {member.userName}
                                </Option>
                            ))}
                        </Select>
                    )}

                    {/* Reporter */}
                    {row(
                        t.tasks.fields.reporter,
                        requiredSwitch("reporter"),
                        <Select
                            placeholder={tc.noneOption}
                            size="sm"
                            sx={controlSx}
                            value={rules.reporter?.default ?? null}
                            onChange={(_, value) => patchRule("reporter", { default: value })}
                        >
                            <Option value={null}>{tc.noneOption}</Option>
                            <Option value="creator">{tc.creatorOption}</Option>
                            {useTEM.teamMembers.map((member) => (
                                <Option key={member.userId} value={member.userId}>
                                    {member.userName}
                                </Option>
                            ))}
                        </Select>
                    )}

                    {/* Footer */}
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ justifyContent: "flex-end", mt: 2 }}
                    >
                        <Button
                            variant="plain"
                            sx={{
                                borderRadius: "10px",
                                // Joy variant CSS vars, not sx `&:hover` —
                                // Joy's `&:not(.selected):hover` outspecifies
                                // it (white-on-white hover otherwise).
                                "--variant-plainColor": "rgba(255,255,255,0.7)",
                                "--variant-plainHoverColor": "#ffffff",
                                "--variant-plainHoverBg": "rgba(255,255,255,0.1)",
                                "--variant-plainActiveBg": "rgba(255,255,255,0.16)",
                            }}
                            onClick={onClose}
                        >
                            {tc.cancel}
                        </Button>
                        <Button
                            loading={isSaving}
                            sx={{
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
                            }}
                            onClick={handleSave}
                        >
                            {tc.save}
                        </Button>
                    </Stack>
                </Box>
            </ModalDialog>
        </Modal>
    );
};
