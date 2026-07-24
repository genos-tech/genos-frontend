import { useEffect, useState } from "react";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    IconButton,
    Input,
    ListItem,
    ListItemContent,
    Stack,
    Typography,
} from "@mui/joy";

import { AppTooltip } from "../../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../../components/ui/avatars/UserAvatar";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { useProjectCustomFields } from "../../../../../hooks/tasks/useProjectCustomFields";
import { useTranslation } from "../../../../../i18n";
import { UserProps } from "../../../../../types/admin";
import { CustomFieldValues, ProjectCustomFieldDef, TaskProps } from "../../../../../types/tasks";
import {
    getCustomFieldString,
    resolveTagOptions,
    setCustomFieldValue,
} from "../../../utils/customFields";
import { ModalManageCustomFields } from "../../modals/ModalManageCustomFields";
import { ProjectTagChip } from "../../ProjectTagChip";

// Row label — a local copy of TaskMainBlock's FieldLabel (that one is
// module-private, and importing it back would create a cycle: the main
// block renders this component). Keep the two visually identical.
const FIELD_LABEL_MIN_WIDTH = 96;
const RowLabel = ({ children, isDark }: { children: React.ReactNode; isDark: boolean }) => (
    <Typography
        level="body-sm"
        sx={{
            minWidth: `${FIELD_LABEL_MIN_WIDTH}px`,
            fontWeight: 500,
            fontSize: "0.825rem",
            letterSpacing: "0.01em",
            color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        }}
    >
        {children}
    </Typography>
);

const subtleIconButtonSx = (isDark: boolean) =>
    ({
        "--IconButton-size": "24px",
        minHeight: "24px",
        minWidth: "24px",
        p: 0,
        borderRadius: "6px",
        color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        opacity: 0.7,
        transition: "opacity 0.15s ease, background 0.15s ease, color 0.15s ease",
        "&:hover": {
            opacity: 1,
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)",
        },
    }) as const;

type ValueWriter = (fieldId: number, value: string | string[] | null) => void;

/**
 * Free-text editor with a local draft, committed on blur / Enter.
 * Writing through on every keystroke would bump `setTaskUpdated` per
 * character — each bump is a full task PUT via the metadata-save
 * effect's `taskUpdateSeq`, so text fields must batch like the title
 * input does, not stream like the pickers.
 */
const TextFieldEditor = ({
    def,
    stored,
    writeValue,
}: {
    def: ProjectCustomFieldDef;
    stored: string;
    writeValue: ValueWriter;
}) => {
    const [draft, setDraft] = useState(stored);
    // Re-seed when the underlying task/value changes (task switch, echo
    // from another client). Safe because commits happen on blur — an
    // in-focus draft is never overwritten by its own echo (stored can
    // only change after the commit that produced it).
    useEffect(() => {
        setDraft(stored);
    }, [stored]);
    const commit = () => {
        if (draft === stored) return;
        writeValue(def.fieldId, draft.trim() === "" ? null : draft);
    };
    return (
        <Input
            size="sm"
            sx={{ width: "100%" }}
            value={draft}
            onBlur={commit}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                    setDraft(stored);
                }
            }}
        />
    );
};

const DateFieldEditor = ({
    def,
    stored,
    isDark,
    clearTooltip,
    writeValue,
}: {
    def: ProjectCustomFieldDef;
    stored: string;
    isDark: boolean;
    clearTooltip: string;
    writeValue: ValueWriter;
}) => (
    <Stack alignItems="center" direction="row" spacing={0.5}>
        <Input
            color="neutral"
            size="sm"
            type="date"
            value={stored}
            variant="outlined"
            sx={{
                "& input::-webkit-calendar-picker-indicator": {
                    filter: isDark ? "invert()" : "none",
                    cursor: "pointer",
                },
            }}
            onChange={(e) => {
                // Unlike Due Date there is no min — custom dates can
                // legitimately be in the past ("agreed on", "shipped").
                writeValue(def.fieldId, e.target.value || null);
            }}
        />
        {stored !== "" && (
            <AppTooltip title={clearTooltip}>
                <IconButton
                    size="sm"
                    sx={subtleIconButtonSx(isDark)}
                    variant="plain"
                    onClick={() => writeValue(def.fieldId, null)}
                >
                    <ClearRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </AppTooltip>
        )}
    </Stack>
);

const TagFieldEditor = ({
    def,
    values,
    isDark,
    placeholder,
    writeValue,
}: {
    def: ProjectCustomFieldDef;
    values: CustomFieldValues | undefined;
    isDark: boolean;
    placeholder: string;
    writeValue: ValueWriter;
}) => {
    const selected = resolveTagOptions(def, values?.[String(def.fieldId)]);
    return (
        <Autocomplete
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            limitTags={3}
            options={def.options}
            placeholder={selected.length === 0 ? placeholder : ""}
            size="sm"
            sx={{ width: "100%" }}
            value={selected}
            renderOption={(props, option) => (
                <AutocompleteOption {...props} key={`cf-opt-${def.fieldId}-${option.id}`}>
                    <ListItemContent sx={{ fontSize: "sm" }}>
                        <ProjectTagChip
                            isDark={isDark}
                            label={option.label}
                            tagColor={option.color}
                        />
                    </ListItemContent>
                </AutocompleteOption>
            )}
            renderTags={(tags, getTagProps) =>
                tags.map((item, index) => {
                    const { key } = getTagProps({ index });
                    return (
                        <ProjectTagChip
                            key={`cf-chip-${key}`}
                            isDark={isDark}
                            label={item.label}
                            tagColor={item.color}
                        />
                    );
                })
            }
            multiple
            onChange={(_event, value) => {
                writeValue(
                    def.fieldId,
                    value.map((o) => o.id)
                );
            }}
        />
    );
};

const MemberFieldEditor = ({
    def,
    stored,
    teamMembers,
    placeholder,
    isDark,
    writeValue,
}: {
    def: ProjectCustomFieldDef;
    stored: string;
    teamMembers: UserProps[];
    placeholder: string;
    isDark: boolean;
    writeValue: ValueWriter;
}) => {
    const selected = teamMembers.find((m) => String(m.userId) === stored) ?? null;
    return (
        <Stack alignItems="center" direction="row" spacing={1} sx={{ width: "100%", minWidth: 0 }}>
            {stored !== "" && <UserAvatar clickable={false} userId={stored} />}
            <Autocomplete
                getOptionLabel={(option) => option.userName || option.userEmail || ""}
                options={teamMembers}
                placeholder={stored === "" ? placeholder : ""}
                size="sm"
                sx={{ flex: 1, minWidth: 0 }}
                value={selected}
                isOptionEqualToValue={(option, value) =>
                    String(option.userId) === String(value?.userId)
                }
                renderOption={(props, option) => (
                    <AutocompleteOption
                        {...props}
                        key={`cf-member-${def.fieldId}-${option.userId}`}
                    >
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{ minWidth: 0 }}
                        >
                            <UserAvatar clickable={false} userId={option.userId} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography level="body-sm" noWrap>
                                    {option.userName}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.5)"
                                            : "rgba(0,0,0,0.5)",
                                    }}
                                    noWrap
                                >
                                    {option.userEmail}
                                </Typography>
                            </Box>
                        </Stack>
                    </AutocompleteOption>
                )}
                onChange={(_event, value) => {
                    writeValue(def.fieldId, value ? String(value.userId) : null);
                }}
            />
        </Stack>
    );
};

type CustomFieldsBlockProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    useTEM: TeamManagementState;
    /** Threaded from TaskMainBlock — lifts the manage modal above a
     *  UrlLinkModal host (mirrors the hostZIndex contract there). */
    hostZIndex?: number;
    isDark: boolean;
};

/**
 * "Custom fields" section of the task metadata block — one row per
 * field the project defines (tag / text / date / member), values
 * stored on the task itself (`taskContent.customFieldValues`).
 *
 * Every editor writes through the same `setTaskContent` +
 * `setTaskUpdated(true)` contract as the built-in metadata pickers, so
 * persistence (task PUT / milestone PATCH / create submit) needs no
 * special-casing per surface. Renders nothing when the project has no
 * fields and the viewer can't manage them.
 */
export const CustomFieldsBlock = (props: CustomFieldsBlockProps) => {
    const { taskContent, setTaskContent, setTaskUpdated, useTEM, hostZIndex, isDark } = props;
    const { t } = useTranslation();
    const projectId = taskContent.project?.projectId ?? null;
    const { fields, canManage } = useProjectCustomFields(projectId);
    const [openManage, setOpenManage] = useState(false);

    if (projectId == null) return null;
    if (fields.length === 0 && !canManage) return null;

    const writeValue: ValueWriter = (fieldId, value) => {
        setTaskContent({
            ...taskContent,
            customFieldValues: setCustomFieldValue(taskContent.customFieldValues, fieldId, value),
        });
        setTaskUpdated?.(true);
    };

    const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder || a.fieldId - b.fieldId);

    return (
        <>
            {/* Section header — mirrors the muted metadata-key styling.
                The gear opens the definition manager (owner/editor only;
                the server enforces the same gate). */}
            <ListItem sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                    }}
                >
                    {t.tasks.customFields.heading}
                </Typography>
                {canManage && (
                    <AppTooltip title={t.tasks.customFields.manageTooltip}>
                        <IconButton
                            size="sm"
                            sx={{ ...subtleIconButtonSx(isDark), ml: 0.5 }}
                            variant="plain"
                            onClick={() => setOpenManage(true)}
                        >
                            <SettingsRoundedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                    </AppTooltip>
                )}
            </ListItem>

            {fields.length === 0 && canManage && (
                <ListItem sx={{ py: 0 }}>
                    <Typography
                        level="body-xs"
                        sx={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
                    >
                        {t.tasks.customFields.emptyHint}
                    </Typography>
                </ListItem>
            )}

            {sorted.map((def) => {
                const stored = getCustomFieldString(taskContent.customFieldValues, def.fieldId);
                return (
                    <ListItem key={def.fieldId} sx={{ display: "flex", alignItems: "center" }}>
                        <RowLabel isDark={isDark}>{def.fieldName}</RowLabel>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {def.fieldType === "tag" ? (
                                <TagFieldEditor
                                    def={def}
                                    isDark={isDark}
                                    placeholder={t.tasks.customFields.tagPlaceholder}
                                    values={taskContent.customFieldValues}
                                    writeValue={writeValue}
                                />
                            ) : def.fieldType === "text" ? (
                                <TextFieldEditor
                                    def={def}
                                    stored={stored}
                                    writeValue={writeValue}
                                />
                            ) : def.fieldType === "date" ? (
                                <DateFieldEditor
                                    clearTooltip={t.tasks.customFields.clearValue}
                                    def={def}
                                    isDark={isDark}
                                    stored={stored}
                                    writeValue={writeValue}
                                />
                            ) : (
                                <MemberFieldEditor
                                    def={def}
                                    isDark={isDark}
                                    placeholder={t.tasks.customFields.memberPlaceholder}
                                    stored={stored}
                                    teamMembers={useTEM.teamMembers}
                                    writeValue={writeValue}
                                />
                            )}
                        </Box>
                    </ListItem>
                );
            })}

            {canManage && projectId != null && (
                <ModalManageCustomFields
                    hostZIndex={hostZIndex}
                    open={openManage}
                    projectId={projectId}
                    onClose={() => setOpenManage(false)}
                />
            )}
        </>
    );
};
