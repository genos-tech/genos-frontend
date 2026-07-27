import React, { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
    Alert,
    Autocomplete,
    AutocompleteOption,
    Box,
    Button,
    Chip,
    IconButton,
    Input,
    ListItemContent,
    Modal,
    ModalDialog,
    Stack,
    Switch,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskEffortLevelProps, TaskPriorityProps } from "../../../../types/tasks";
import { getFormattedNDaysAfterDateStr } from "../../../../utils/dateUtils";
import { loadProjectTags } from "../../services/loadProjectTags";
import { saveProjectTaskFieldRules } from "../../services/projectTaskFieldRules";
import { ConfigurableTaskField, TaskFieldRule, TaskFieldRules } from "../../utils/taskFieldRules";
import { effortLevels, priorities } from "../../utils/taskMeta";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

// Sentinel value for the "Creator" option in the assignee/reporter
// default pickers (resolves to the task creator at creation time).
const CREATOR = "creator";

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useTM: TaskManagementState;
    open: boolean;
    onClose: () => void;
};

// One selectable person for the assignee/reporter default pickers: a real
// team member, or the synthetic "Creator" sentinel.
type PersonOption = { value: string; label: string; userId: string | null };

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
 * Theme-aware (light/dark) so the default-value pickers — Joy
 * Autocompletes whose options mirror the real TaskMainBlock pickers
 * (colored tag/priority/effort chips, member avatars) — read correctly
 * and their portaled listboxes match the ambient theme. Saves the whole
 * blob via PUT (server enforces the owner gate) and writes the response
 * straight back into `useTM.taskFieldRules`.
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

    // ---- Theme-aware palette (mirrors the create-form surfaces) ----
    const textPrimary = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)";
    const textMuted = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
    const rowBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    const labelSx = { color: textPrimary, fontWeight: 600 };
    const hintSx = { color: textMuted, fontStyle: "italic" };
    const controlSx = { width: "100%" };

    const people: PersonOption[] = [
        { value: CREATOR, label: tc.creatorOption, userId: null },
        ...useTEM.teamMembers.map((member) => ({
            value: member.userId,
            label: member.userName,
            userId: member.userId,
        })),
    ];

    const requiredSwitch = (field: ConfigurableTaskField, disabled = false) => (
        <Switch
            checked={rules[field]?.required === true}
            disabled={disabled}
            size="sm"
            onChange={(e) => patchRule(field, { required: e.target.checked })}
        />
    );

    // Priority / effort default picker — soft colored chip, same as
    // ACTaskPriority / ACTaskEffortLevel.
    const vocabPicker = (
        field: "priority" | "effortLevel",
        options: Array<TaskPriorityProps | TaskEffortLevelProps>,
        labelOf: (opt: TaskPriorityProps | TaskEffortLevelProps) => string | null
    ) => {
        const selected = options.find((opt) => labelOf(opt) === rules[field]?.default) ?? null;
        const chip = (opt: TaskPriorityProps | TaskEffortLevelProps) => (
            <Chip
                size="sm"
                variant="soft"
                sx={{
                    backgroundColor: opt.color
                        ? alpha(opt.color, isDark ? 0.5 : 1)
                        : "transparent",
                    color: opt.textColor,
                    fontWeight: "bold",
                    borderRadius: "5px",
                }}
            >
                {labelOf(opt)}
            </Chip>
        );
        return (
            <Autocomplete
                getOptionLabel={(opt) => labelOf(opt) ?? ""}
                isOptionEqualToValue={(opt, value) => labelOf(opt) === labelOf(value)}
                options={options}
                placeholder={tc.noneOption}
                size="sm"
                sx={controlSx}
                value={selected}
                renderOption={(optionProps, opt) => (
                    <AutocompleteOption {...optionProps} key={labelOf(opt) ?? ""}>
                        <ListItemContent sx={{ fontSize: "sm" }}>{chip(opt)}</ListItemContent>
                    </AutocompleteOption>
                )}
                onChange={(_, value) =>
                    patchRule(field, { default: value ? labelOf(value) : null })
                }
            />
        );
    };

    // Assignee / reporter default picker — member avatar + name (or the
    // Creator sentinel), mirroring ACTeamUsers.
    const peoplePicker = (field: "assignee" | "reporter") => {
        const selected = people.find((p) => p.value === rules[field]?.default) ?? null;
        return (
            <Autocomplete
                getOptionLabel={(opt) => opt.label}
                isOptionEqualToValue={(opt, value) => opt.value === value.value}
                options={people}
                placeholder={tc.noneOption}
                size="sm"
                sx={controlSx}
                value={selected}
                renderOption={(optionProps, opt) => (
                    <AutocompleteOption {...optionProps} key={opt.value}>
                        <ListItemContent sx={{ fontSize: "sm" }}>
                            <Stack alignItems="center" direction="row" spacing={1}>
                                {opt.userId ? (
                                    <UserAvatar
                                        clickable={false}
                                        showPulseDot={false}
                                        userId={opt.userId}
                                    />
                                ) : (
                                    <PersonRoundedIcon sx={{ fontSize: 20, color: textMuted }} />
                                )}
                                <Typography level="body-sm">{opt.label}</Typography>
                            </Stack>
                        </ListItemContent>
                    </AutocompleteOption>
                )}
                onChange={(_, value) => patchRule(field, { default: value ? value.value : null })}
            />
        );
    };

    // Tags default picker — outlined mode-aware chip, same as ACProjectTags.
    const tagChipSx = (tag: TagListProps) => ({
        color: isDark ? "white" : "black",
        fontWeight: "bold",
        borderRadius: "5px",
        borderWidth: "3px",
        borderColor: alpha(tag.tagColor, isDark ? 0.5 : 0.75),
    });
    const tagsPicker = (
        <Autocomplete
            getOptionLabel={(tag: TagListProps) => tag.tagName}
            isOptionEqualToValue={(a, b) => a.tagName === b.tagName}
            limitTags={3}
            options={projectTags}
            placeholder={tc.noneOption}
            size="sm"
            sx={controlSx}
            renderOption={(optionProps, tag) => (
                <AutocompleteOption {...optionProps} key={tag.tagName}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <Chip size="sm" sx={tagChipSx(tag)} variant="outlined">
                            {tag.tagName}
                        </Chip>
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.map((tag, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                        <Chip
                            key={key ?? tag.tagName}
                            {...tagProps}
                            size="sm"
                            sx={tagChipSx(tag)}
                            variant="outlined"
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
                patchRule("tags", { defaultTagNames: value.map((tag) => tag.tagName) })
            }
        />
    );

    // One grid row: label | required control | default control.
    const row = (label: string, required: React.ReactNode, defaultControl: React.ReactNode) => (
        <Box
            key={label}
            sx={{
                display: "grid",
                gridTemplateColumns: "120px 80px 1fr",
                alignItems: "center",
                gap: 1,
                py: 0.75,
                borderBottom: `1px solid ${rowBorder}`,
            }}
        >
            <Typography level="body-sm" sx={labelSx}>
                {label}
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "center" }}>{required}</Box>
            <Box sx={{ minWidth: 0 }}>{defaultControl}</Box>
        </Box>
    );

    // Project + Status are locked (not customizable) — a muted "auto"
    // marker in place of a control.
    const lockedRequired = <LockOutlinedIcon sx={{ color: textMuted, fontSize: 16 }} />;
    const autoDefault = (hint: string) => (
        <Typography level="body-xs" sx={hintSx}>
            {hint}
        </Typography>
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
                    background: isDark
                        ? "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)"
                        : "linear-gradient(145deg, #ffffff 0%, #fafaff 100%)",
                    border: `1px solid ${isDark ? "rgba(var(--gp-brand-700-rgb), 0.2)" : "rgba(var(--gp-brand-700-rgb), 0.15)"}`,
                    borderRadius: "16px",
                    boxShadow: isDark
                        ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-brand-700-rgb), 0.1)"
                        : "0 25px 50px -12px rgba(0, 0, 0, 0.18)",
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
                                "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brandalt-500-rgb), 0.2) 100%)",
                            border: "1px solid rgba(var(--gp-brand-700-rgb), 0.3)",
                        }}
                    >
                        <TuneRoundedIcon
                            sx={{ color: "rgba(var(--gp-brandalt-500-rgb), 0.9)", fontSize: 22 }}
                        />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{
                            background: isDark
                                ? "linear-gradient(135deg, var(--gp-brandalt-200) 0%, var(--gp-brandalt-300) 100%)"
                                : "linear-gradient(135deg, var(--gp-brand-800) 0%, var(--gp-brand-700) 100%)",
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
                            color: textMuted,
                            "&:hover": { color: textPrimary },
                        }}
                        onClick={onClose}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                <Typography level="body-xs" sx={{ color: textMuted, mb: 2 }}>
                    {tc.description}
                </Typography>

                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
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
                            gridTemplateColumns: "120px 80px 1fr",
                            gap: 1,
                            pb: 0.5,
                            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                        }}
                    >
                        <span />
                        <Typography level="body-xs" sx={{ color: textMuted, textAlign: "center" }}>
                            {tc.requiredLabel}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: textMuted }}>
                            {tc.defaultLabel}
                        </Typography>
                    </Box>

                    {/* Order per product: Project, Reporter, Assignee, Due
                        Date, Tags, Effort Level, Priority, Status. */}

                    {/* Project — always required, nothing to configure. */}
                    {row(t.tasks.fields.project, lockedRequired, autoDefault(tc.alwaysRequired))}

                    {/* Reporter */}
                    {row(
                        t.tasks.fields.reporter,
                        requiredSwitch("reporter"),
                        peoplePicker("reporter")
                    )}

                    {/* Assignee */}
                    {row(
                        t.tasks.fields.assignee,
                        requiredSwitch("assignee"),
                        peoplePicker("assignee")
                    )}

                    {/* Due date — offset default ("today + N"). */}
                    {row(
                        t.tasks.fields.dueDate,
                        requiredSwitch("dueDate"),
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flexWrap: "wrap",
                            }}
                        >
                            <Typography level="body-sm" sx={{ color: textPrimary }}>
                                {tc.dueOffsetPrefix}
                            </Typography>
                            <Input
                                size="sm"
                                sx={{ width: "72px" }}
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
                            <Typography level="body-sm" sx={{ color: textPrimary }}>
                                {tc.dueOffsetSuffix}
                            </Typography>
                            {dueOffset != null && (
                                <Typography level="body-xs" sx={hintSx}>
                                    → {getFormattedNDaysAfterDateStr(dueOffset)}
                                </Typography>
                            )}
                        </Box>
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
                        tagsPicker
                    )}

                    {/* Effort level */}
                    {row(
                        t.tasks.fields.effortLevel,
                        requiredSwitch("effortLevel"),
                        vocabPicker("effortLevel", effortLevels, (opt) =>
                            "level" in opt ? opt.level : null
                        )
                    )}

                    {/* Priority */}
                    {row(
                        t.tasks.fields.priority,
                        requiredSwitch("priority"),
                        vocabPicker("priority", priorities, (opt) =>
                            "priority" in opt ? opt.priority : null
                        )
                    )}

                    {/* Status — always auto-set at creation, fully locked. */}
                    {row(t.tasks.fields.status, lockedRequired, autoDefault(tc.statusAuto))}

                    {/* Footer */}
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ justifyContent: "flex-end", mt: 2 }}
                    >
                        <Button
                            color="neutral"
                            sx={{ borderRadius: "10px" }}
                            variant="plain"
                            onClick={onClose}
                        >
                            {tc.cancel}
                        </Button>
                        <Button
                            loading={isSaving}
                            sx={{
                                borderRadius: "10px",
                                background:
                                    "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brandalt-500) 100%)",
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
