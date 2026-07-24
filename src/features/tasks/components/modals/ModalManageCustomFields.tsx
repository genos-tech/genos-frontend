import React, { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
    Alert,
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
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useAuth } from "../../../../context/AuthContext";
import {
    refreshProjectCustomFields,
    useProjectCustomFields,
} from "../../../../hooks/tasks/useProjectCustomFields";
import { useTranslation } from "../../../../i18n";
import {
    CustomFieldOption,
    CustomFieldType,
    ProjectCustomFieldDef,
} from "../../../../types/tasks";
import {
    createProjectCustomField,
    deleteProjectCustomField,
    reorderProjectCustomFields,
    updateProjectCustomField,
} from "../../services/projectCustomFields";
import { ColorPickerMenu } from "../contents/base/sub/TagColorPickerMenu";
import { ProjectTagChip } from "../ProjectTagChip";

const FIELD_TYPES: CustomFieldType[] = ["tag", "text", "date", "member"];

const DEFAULT_OPTION_COLOR = { chipColor: "#0044c2", textColor: "white" };

const mintOptionId = (): string => `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Props = {
    projectId: number;
    open: boolean;
    onClose: () => void;
    /** Present when the hosting preview lives inside the UrlLinkModal —
     *  this dialog must stack above that host. */
    hostZIndex?: number;
};

/**
 * Definition manager for a project's custom task fields. Owner/editor
 * only (entry points are gated on `canManage`; the server enforces the
 * same rule on every mutation).
 *
 * Every mutation round-trips through the API and then refreshes the
 * shared `useProjectCustomFields` store, so the preview rows, the
 * table columns and the column-settings list all update live.
 *
 * Theme-aware (unlike the older hard-dark ModalManageTags shell) —
 * follows the ModalCustomizeTaskFields precedent so the portaled
 * pickers keep readable hover states in light mode.
 */
export const ModalManageCustomFields: React.FC<Props> = ({
    projectId,
    open,
    onClose,
    hostZIndex,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { fields } = useProjectCustomFields(projectId);
    const msgs = t.tasks.customFields;

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Add-field draft
    const [newFieldName, setNewFieldName] = useState("");
    const [newFieldType, setNewFieldType] = useState<CustomFieldType>("tag");

    // Per-field edit state
    const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [expandedOptionsId, setExpandedOptionsId] = useState<number | null>(null);

    // Option draft (for the expanded tag field)
    const [newOptionLabel, setNewOptionLabel] = useState("");
    const [newOptionColor, setNewOptionColor] = useState(DEFAULT_OPTION_COLOR);

    useEffect(() => {
        if (!open) {
            setErrorMessage(null);
            setEditingFieldId(null);
            setConfirmDeleteId(null);
            setExpandedOptionsId(null);
            setNewFieldName("");
            setNewOptionLabel("");
        }
    }, [open]);

    const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder || a.fieldId - b.fieldId);

    const refresh = () => refreshProjectCustomFields(projectId, accessToken);

    const run = async (action: () => Promise<boolean>) => {
        setBusy(true);
        setErrorMessage(null);
        try {
            const ok = await action();
            if (!ok) setErrorMessage(msgs.requestFailed);
            else await refresh();
        } finally {
            setBusy(false);
        }
    };

    const handleAddField = () =>
        run(async () => {
            const name = newFieldName.trim();
            if (!name) return true;
            const created = await createProjectCustomField(
                projectId,
                { fieldName: name, fieldType: newFieldType, options: [] },
                accessToken
            );
            if (created) {
                setNewFieldName("");
                if (created.fieldType === "tag") setExpandedOptionsId(created.fieldId);
            }
            return created != null;
        });

    const handleRename = (field: ProjectCustomFieldDef) =>
        run(async () => {
            const name = editName.trim();
            if (!name || name === field.fieldName) {
                setEditingFieldId(null);
                return true;
            }
            const updated = await updateProjectCustomField(
                projectId,
                field.fieldId,
                { fieldName: name },
                accessToken
            );
            if (updated) setEditingFieldId(null);
            return updated != null;
        });

    const handleDelete = (fieldId: number) =>
        run(async () => {
            const ok = await deleteProjectCustomField(projectId, fieldId, accessToken);
            if (ok) setConfirmDeleteId(null);
            return ok;
        });

    const handleMove = (index: number, delta: -1 | 1) => {
        const target = index + delta;
        if (target < 0 || target >= sorted.length) return;
        const order = sorted.map((f) => f.fieldId);
        [order[index], order[target]] = [order[target], order[index]];
        void run(async () => {
            const res = await reorderProjectCustomFields(projectId, order, accessToken);
            return res != null;
        });
    };

    const writeOptions = (field: ProjectCustomFieldDef, options: CustomFieldOption[]) =>
        run(async () => {
            const updated = await updateProjectCustomField(
                projectId,
                field.fieldId,
                { options },
                accessToken
            );
            return updated != null;
        });

    const handleAddOption = (field: ProjectCustomFieldDef) => {
        const label = newOptionLabel.trim();
        if (!label) return;
        const next: CustomFieldOption[] = [
            ...field.options,
            {
                id: mintOptionId(),
                label,
                color: newOptionColor.chipColor,
                textColor: newOptionColor.textColor,
            },
        ];
        setNewOptionLabel("");
        void writeOptions(field, next);
    };

    const typeLabel = (type: CustomFieldType): string => msgs.types[type];

    const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const faint = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

    return (
        <Modal
            open={open}
            sx={{ zIndex: hostZIndex != null ? hostZIndex + 10 : 10010 }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="md"
                sx={{
                    width: { xs: "calc(100vw - 24px)", md: 560 },
                    maxWidth: "96vw",
                    maxHeight: "82vh",
                    overflowY: "auto",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                {/* Header */}
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <TuneRoundedIcon sx={{ fontSize: 20, color: faint }} />
                    <Typography level="title-md" sx={{ flex: 1 }}>
                        {msgs.manageHeading}
                    </Typography>
                    <IconButton size="sm" variant="plain" onClick={onClose}>
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Stack>
                <Typography level="body-xs" sx={{ mb: 1.5, color: faint }}>
                    {msgs.manageDescription}
                </Typography>

                {errorMessage && (
                    <Alert color="danger" size="sm" sx={{ mb: 1.5, borderRadius: "8px" }}>
                        {errorMessage}
                    </Alert>
                )}

                {/* Field list */}
                <Stack spacing={0.75}>
                    {sorted.length === 0 && (
                        <Typography
                            level="body-sm"
                            sx={{ color: faint, textAlign: "center", py: 2 }}
                        >
                            {msgs.noFieldsYet}
                        </Typography>
                    )}
                    {sorted.map((field, index) => (
                        <Box
                            key={field.fieldId}
                            sx={{
                                border: "1px solid",
                                borderColor: border,
                                borderRadius: "10px",
                                p: 1,
                            }}
                        >
                            <Stack alignItems="center" direction="row" spacing={0.75}>
                                {/* Reorder */}
                                <Stack spacing={-0.5}>
                                    <IconButton
                                        disabled={busy || index === 0}
                                        size="sm"
                                        sx={{ "--IconButton-size": "20px", minHeight: 20 }}
                                        variant="plain"
                                        onClick={() => handleMove(index, -1)}
                                    >
                                        <KeyboardArrowUpRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                    <IconButton
                                        disabled={busy || index === sorted.length - 1}
                                        size="sm"
                                        sx={{ "--IconButton-size": "20px", minHeight: 20 }}
                                        variant="plain"
                                        onClick={() => handleMove(index, 1)}
                                    >
                                        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Stack>

                                {/* Tag fields expand to their options editor */}
                                {field.fieldType === "tag" ? (
                                    <IconButton
                                        size="sm"
                                        sx={{ "--IconButton-size": "22px" }}
                                        variant="plain"
                                        onClick={() =>
                                            setExpandedOptionsId(
                                                expandedOptionsId === field.fieldId
                                                    ? null
                                                    : field.fieldId
                                            )
                                        }
                                    >
                                        {expandedOptionsId === field.fieldId ? (
                                            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />
                                        ) : (
                                            <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16 }} />
                                        )}
                                    </IconButton>
                                ) : (
                                    <Box sx={{ width: 22 }} />
                                )}

                                {editingFieldId === field.fieldId ? (
                                    <>
                                        <Input
                                            size="sm"
                                            sx={{ flex: 1 }}
                                            value={editName}
                                            autoFocus
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRename(field);
                                                if (e.key === "Escape") setEditingFieldId(null);
                                            }}
                                        />
                                        <IconButton
                                            disabled={busy || !editName.trim()}
                                            size="sm"
                                            variant="plain"
                                            onClick={() => handleRename(field)}
                                        >
                                            <CheckRoundedIcon sx={{ fontSize: 17 }} />
                                        </IconButton>
                                        <IconButton
                                            size="sm"
                                            variant="plain"
                                            onClick={() => setEditingFieldId(null)}
                                        >
                                            <CloseRoundedIcon sx={{ fontSize: 17 }} />
                                        </IconButton>
                                    </>
                                ) : (
                                    <>
                                        <Typography
                                            level="body-sm"
                                            sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}
                                            noWrap
                                        >
                                            {field.fieldName}
                                        </Typography>
                                        <Chip
                                            size="sm"
                                            sx={{ fontSize: "0.68rem", borderRadius: "5px" }}
                                            variant="soft"
                                        >
                                            {typeLabel(field.fieldType)}
                                        </Chip>
                                        {confirmDeleteId === field.fieldId ? (
                                            <>
                                                <Typography
                                                    level="body-xs"
                                                    sx={{ color: "danger.400" }}
                                                >
                                                    {msgs.deletePrompt}
                                                </Typography>
                                                <Button
                                                    color="danger"
                                                    disabled={busy}
                                                    size="sm"
                                                    sx={{ minHeight: 24, fontSize: "0.7rem" }}
                                                    variant="soft"
                                                    onClick={() => handleDelete(field.fieldId)}
                                                >
                                                    {msgs.deleteYes}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    sx={{ minHeight: 24, fontSize: "0.7rem" }}
                                                    variant="plain"
                                                    onClick={() => setConfirmDeleteId(null)}
                                                >
                                                    {msgs.deleteNo}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <AppTooltip title={msgs.renameTooltip}>
                                                    <IconButton
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() => {
                                                            setEditingFieldId(field.fieldId);
                                                            setEditName(field.fieldName);
                                                            setConfirmDeleteId(null);
                                                        }}
                                                    >
                                                        <EditRoundedIcon sx={{ fontSize: 15 }} />
                                                    </IconButton>
                                                </AppTooltip>
                                                <AppTooltip title={msgs.deleteTooltip}>
                                                    <IconButton
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() => {
                                                            setConfirmDeleteId(field.fieldId);
                                                            setEditingFieldId(null);
                                                        }}
                                                    >
                                                        <DeleteOutlineRoundedIcon
                                                            sx={{ fontSize: 15 }}
                                                        />
                                                    </IconButton>
                                                </AppTooltip>
                                            </>
                                        )}
                                    </>
                                )}
                            </Stack>

                            {/* Options editor (tag fields, expanded) */}
                            {field.fieldType === "tag" && expandedOptionsId === field.fieldId && (
                                <Box sx={{ mt: 1, pl: 4.5 }}>
                                    <Stack spacing={0.5}>
                                        {field.options.map((option) => (
                                            <Stack
                                                key={option.id}
                                                alignItems="center"
                                                direction="row"
                                                spacing={1}
                                            >
                                                <ProjectTagChip
                                                    isDark={isDark}
                                                    label={option.label}
                                                    tagColor={option.color}
                                                />
                                                <Box sx={{ flex: 1 }} />
                                                <AppTooltip title={msgs.deleteOptionTooltip}>
                                                    <IconButton
                                                        disabled={busy}
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() =>
                                                            void writeOptions(
                                                                field,
                                                                field.options.filter(
                                                                    (o) => o.id !== option.id
                                                                )
                                                            )
                                                        }
                                                    >
                                                        <DeleteOutlineRoundedIcon
                                                            sx={{ fontSize: 14 }}
                                                        />
                                                    </IconButton>
                                                </AppTooltip>
                                            </Stack>
                                        ))}
                                        {/* Add option */}
                                        <Stack alignItems="center" direction="row" spacing={0.75}>
                                            <Input
                                                placeholder={msgs.optionNamePlaceholder}
                                                size="sm"
                                                sx={{ flex: 1 }}
                                                value={newOptionLabel}
                                                onChange={(e) => setNewOptionLabel(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAddOption(field);
                                                }}
                                            />
                                            <ColorPickerMenu
                                                onSelectColor={(color) =>
                                                    setNewOptionColor({
                                                        chipColor: color.value,
                                                        textColor: color.textColor,
                                                    })
                                                }
                                            />
                                            <ProjectTagChip
                                                isDark={isDark}
                                                label={newOptionLabel || msgs.optionPreviewName}
                                                tagColor={newOptionColor.chipColor}
                                            />
                                            <Button
                                                disabled={busy || newOptionLabel.trim() === ""}
                                                size="sm"
                                                variant="soft"
                                                startDecorator={
                                                    <AddRoundedIcon sx={{ fontSize: 15 }} />
                                                }
                                                sx={{
                                                    minHeight: 28,
                                                    fontSize: "0.72rem",
                                                }}
                                                onClick={() => handleAddOption(field)}
                                            >
                                                {msgs.addOption}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Box>
                            )}
                        </Box>
                    ))}
                </Stack>

                {/* Add field */}
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.75}
                    sx={{
                        mt: 1.5,
                        pt: 1.5,
                        borderTop: "1px solid",
                        borderColor: border,
                    }}
                >
                    <Input
                        placeholder={msgs.fieldNamePlaceholder}
                        size="sm"
                        sx={{ flex: 1 }}
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddField();
                        }}
                    />
                    <Select
                        size="sm"
                        sx={{ minWidth: 110 }}
                        value={newFieldType}
                        onChange={(_e, value) => {
                            if (value) setNewFieldType(value);
                        }}
                    >
                        {FIELD_TYPES.map((type) => (
                            <Option key={type} value={type}>
                                {typeLabel(type)}
                            </Option>
                        ))}
                    </Select>
                    <Button
                        disabled={busy || newFieldName.trim() === ""}
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        onClick={handleAddField}
                    >
                        {msgs.addField}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
