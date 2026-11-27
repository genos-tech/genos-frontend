import { KeyboardEvent, useEffect, useId, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DonutLargeRoundedIcon from "@mui/icons-material/DonutLargeRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ToggleOffRoundedIcon from "@mui/icons-material/ToggleOffRounded";
import ToggleOnRoundedIcon from "@mui/icons-material/ToggleOnRounded";
import { Alert, Box, Button, Chip, Input, Option, Select } from "@mui/joy";

import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { SkeletonRows, Spinner } from "../../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import {
    MODAL_FRAME_DEFAULT_Z_INDEX,
    ModalFrame,
} from "../../../../components/ui/modal/ModalFrame";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { useAuth } from "../../../../context/authState";
import {
    refreshProjectStatuses,
    setProjectStatuses,
    useProjectStatuses,
} from "../../../../hooks/tasks/useProjectStatuses";
import { fmt, useTranslation } from "../../../../i18n";
import { focusRing, g, type } from "../../../../theme/tokens";
import { ProjectStatusDef } from "../../../../types/tasks";
import {
    createProjectStatus,
    deleteProjectStatus,
    reorderProjectStatuses,
    StatusWriteResult,
    updateProjectStatus,
} from "../../services/projectStatuses";
import {
    BUILTIN_STATUSES,
    MAX_STATUS_NAME,
    MAX_STATUSES,
    sortStatuses,
    STATUS_CATEGORIES,
    statusRowName,
} from "../../utils/projectStatus";
import { StatusLabel } from "../meta/StatusLabel";
import { CategoryHeading, useCategoryName } from "./statusChoices";
import { StatusColorMenu } from "./StatusColorMenu";

type Props = {
    projectId: number;
    open: boolean;
    onClose: () => void;
    /** The layer of the surface that opened this, when it is itself a dialog. */
    hostZIndex?: number;
};

type Deleting = { row: ProjectStatusDef; inUse: number | null; replacementId: number | null };

const rowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: 44,
    paddingInlineStart: 0.75,
    paddingInlineEnd: 0.5,
    "&:not(:first-of-type)": { borderTop: `1px solid ${g.border.subtle}` },
} as const;

const nameButtonSx = {
    ...type("body-md"),
    flex: 1,
    minWidth: 0,
    background: "none",
    border: 0,
    borderRadius: g.radius.sm,
    color: "inherit",
    cursor: "text",
    font: "inherit",
    textAlign: "start",
    py: 0.75,
    px: 0.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "&:hover": { background: g.hover },
    "&:focus:not(:focus-visible)": { outline: "none" },
    "&:focus-visible": focusRing,
    "@media (pointer: coarse)": { minHeight: 44 },
} as const;

const srOnly = {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
} as const;

const NameInput = ({
    initial,
    label,
    describedBy,
    onSave,
    onCancel,
}: {
    initial: string;
    label: string;
    describedBy?: string;
    onSave: (name: string) => void;
    onCancel: () => void;
}) => {
    const [value, setValue] = useState(initial);
    const [done, setDone] = useState(false);
    const finish = (save: boolean) => {
        if (done) return;
        setDone(true);
        const name = value.trim();
        if (save && name && name !== initial) onSave(name);
        else onCancel();
    };
    return (
        <Input
            autoFocus
            endDecorator={
                value.length >= MAX_STATUS_NAME - 4 ? (
                    <Box component="span" sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                        {`${value.length}/${MAX_STATUS_NAME}`}
                    </Box>
                ) : null
            }
            placeholder={label}
            size="sm"
            slotProps={{
                input: {
                    "aria-label": label,
                    "aria-describedby": describedBy,
                    maxLength: MAX_STATUS_NAME,
                    enterKeyHint: "done",
                },
            }}
            sx={{ flex: 1, minWidth: 0 }}
            value={value}
            onBlur={() => finish(true)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    finish(true);
                } else if (e.key === "Escape") {
                    // The dialog must not close with it.
                    e.preventDefault();
                    e.stopPropagation();
                    finish(false);
                }
            }}
        />
    );
};

/**
 * A project's statuses (MIP-2493): grouped by the five categories that automations read, where
 * the team renames, recolours, adds, orders, turns off and deletes. Every action saves at once.
 */
export const ModalProjectStatuses = ({ projectId, open, onClose, hostZIndex }: Props) => {
    const { t } = useTranslation();
    const words = t.tasks.projectStatuses;
    const categoryName = useCategoryName();
    const { accessToken } = useAuth();
    const entry = useProjectStatuses(open ? projectId : null);
    const rows = sortStatuses(entry.statuses);
    const layer = hostZIndex != null ? hostZIndex + 2 : MODAL_FRAME_DEFAULT_Z_INDEX;
    const errorId = useId();

    const [busyId, setBusyId] = useState<number | string | null>(null);
    const [error, setError] = useState<{ at: number | string; text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [addingTo, setAddingTo] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<Deleting | null>(null);
    const [announcement, setAnnouncement] = useState("");

    // A teammate may have changed the list since it was first read.
    useEffect(() => {
        if (open) void refreshProjectStatuses(projectId, accessToken);
        else {
            setError(null);
            setEditingId(null);
            setAddingTo(null);
            setDeleting(null);
        }
    }, [open, projectId, accessToken]);

    const errorText = (code: string) =>
        code === "name_taken"
            ? words.nameTaken
            : code === "name_reserved"
              ? words.nameReserved
              : code === "name_too_long"
                ? fmt(words.nameTooLong, { max: MAX_STATUS_NAME })
                : code === "name_required"
                  ? words.nameEmpty
                  : words.saveFailed;

    const save = async (
        at: number | string,
        write: () => Promise<StatusWriteResult>
    ): Promise<StatusWriteResult> => {
        setBusyId(at);
        setError(null);
        const result = await write();
        setBusyId(null);
        if (result.ok) setProjectStatuses(projectId, result.data);
        else setError({ at, text: errorText(result.code) });
        return result;
    };

    const nameOf = (row: ProjectStatusDef) => statusRowName(row, t.tasks);

    const move = async (row: ProjectStatusDef, step: -1 | 1) => {
        const group = rows.filter((r) => r.category === row.category);
        const from = group.findIndex((r) => r.statusId === row.statusId);
        const to = from + step;
        if (to < 0 || to >= group.length || busyId != null) return;
        const ids = rows.map((r) => r.statusId);
        const a = ids.indexOf(row.statusId);
        const b = ids.indexOf(group[to].statusId);
        [ids[a], ids[b]] = [ids[b], ids[a]];
        const result = await save(row.statusId, () =>
            reorderProjectStatuses(projectId, ids, accessToken)
        );
        if (result.ok) {
            setAnnouncement(
                fmt(words.moved, {
                    name: nameOf(row),
                    position: to + 1,
                    total: group.length,
                    category: categoryName(row.category),
                })
            );
        }
    };

    const patch = (row: ProjectStatusDef, change: Parameters<typeof updateProjectStatus>[2]) =>
        save(row.statusId, () =>
            updateProjectStatus(projectId, row.statusId, change, accessToken)
        );

    const menuFor = (row: ProjectStatusDef, index: number, count: number): MoreMenuItem[] => [
        {
            id: "rename",
            label: words.rename,
            icon: <DriveFileRenameOutlineRoundedIcon />,
            // After the menu has handed focus back to its trigger, or the field loses it.
            onClick: () => window.setTimeout(() => setEditingId(row.statusId), 0),
        },
        {
            id: "up",
            label: words.moveUp,
            icon: <ArrowUpwardRoundedIcon />,
            visible: index > 0,
            onClick: () => void move(row, -1),
        },
        {
            id: "down",
            label: words.moveDown,
            icon: <ArrowDownwardRoundedIcon />,
            visible: index < count - 1,
            onClick: () => void move(row, 1),
        },
        {
            id: "default",
            label: words.makeDefault,
            icon: <CheckRoundedIcon />,
            visible: !row.isDefault && !row.isArchived,
            onClick: () => void patch(row, { is_default: true }),
        },
        {
            id: "off",
            label: words.turnOff,
            icon: <ToggleOffRoundedIcon />,
            visible: row.canTurnOff && !row.isArchived,
            onClick: () => void patch(row, { archived: true }),
        },
        {
            id: "on",
            label: words.turnOn,
            icon: <ToggleOnRoundedIcon />,
            visible: row.isArchived,
            onClick: () => void patch(row, { archived: false }),
        },
        {
            id: "delete",
            label: words.delete,
            icon: <DeleteOutlineRoundedIcon />,
            danger: true,
            visible: row.canDelete,
            onClick: () => setDeleting({ row, inUse: null, replacementId: null }),
        },
    ];

    const rowView = (row: ProjectStatusDef, index: number, count: number) => {
        const name = nameOf(row);
        const failed = error?.at === row.statusId ? error.text : null;
        return (
            <Box
                key={row.statusId}
                component="li"
                sx={{ "&:not(:first-of-type)": rowSx["&:not(:first-of-type)"] }}
            >
                <Box
                    sx={{ ...rowSx, "&:not(:first-of-type)": undefined }}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                        e.preventDefault();
                        void move(row, e.key === "ArrowUp" ? -1 : 1);
                    }}
                >
                    <StatusColorMenu
                        name={name}
                        row={row}
                        zIndex={layer + 10}
                        onPick={(color) => {
                            if (color !== row.color) void patch(row, { color });
                        }}
                    />
                    {editingId === row.statusId ? (
                        <NameInput
                            describedBy={failed ? errorId : undefined}
                            initial={name}
                            label={words.nameLabel}
                            onCancel={() => setEditingId(null)}
                            onSave={(next) => {
                                setEditingId(null);
                                void patch(row, { name: next });
                            }}
                        />
                    ) : (
                        <Box
                            component="button"
                            data-testid="status-name"
                            sx={{
                                ...nameButtonSx,
                                color: row.isArchived ? g.text.tertiary : g.text.primary,
                            }}
                            title={name}
                            type="button"
                            onClick={() => setEditingId(row.statusId)}
                        >
                            {name}
                        </Box>
                    )}
                    {busyId === row.statusId ? (
                        <Spinner label={words.saving} />
                    ) : (
                        <>
                            {row.isDefault && (
                                <Chip color="neutral" size="sm" variant="soft">
                                    {words.default}
                                </Chip>
                            )}
                            {row.isArchived && (
                                <Chip color="neutral" size="sm" variant="outlined">
                                    {words.off}
                                </Chip>
                            )}
                        </>
                    )}
                    <Box
                        aria-hidden={row.canDelete}
                        aria-label={row.canDelete ? undefined : words.builtinHint}
                        role={row.canDelete ? undefined : "img"}
                        sx={{
                            display: "inline-flex",
                            width: 14,
                            flexShrink: 0,
                            color: g.text.tertiary,
                        }}
                        title={row.canDelete ? undefined : words.builtinHint}
                    >
                        {!row.canDelete && <LockOutlinedIcon sx={{ fontSize: 14 }} />}
                    </Box>
                    <Box
                        sx={{
                            "@media (pointer: coarse)": { "& button": { width: 44, height: 44 } },
                        }}
                    >
                        <MoreMenu
                            ariaLabel={fmt(words.moreActions, { name })}
                            items={menuFor(row, index, count)}
                            placement="bottom-end"
                            triggerSize={32}
                            zIndex={layer + 10}
                        />
                    </Box>
                </Box>
                {failed && (
                    <Box
                        id={errorId}
                        role="alert"
                        sx={{ ...type("body-xs"), color: g.danger.text, px: 2, pb: 1 }}
                    >
                        {failed}
                    </Box>
                )}
            </Box>
        );
    };

    const atLimit = rows.length >= MAX_STATUSES;

    const groups = () => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pb: 2 }}>
            <Box
                sx={{
                    ...type("body-xs"),
                    color: atLimit ? g.warning.text : g.text.tertiary,
                    textAlign: "end",
                    mb: -1.5,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {atLimit
                    ? fmt(words.limitHint, { max: MAX_STATUSES })
                    : fmt(words.count, { n: rows.length, max: MAX_STATUSES })}
            </Box>
            {STATUS_CATEGORIES.map((category) => {
                const group = rows.filter((r) => r.category === category);
                const headingId = `${errorId}-${category}`;
                const addError = error?.at === `add:${category}` ? error.text : null;
                return (
                    <Box key={category} aria-labelledby={headingId} role="group">
                        <Box sx={{ display: "flex", alignItems: "center", minHeight: 32 }}>
                            <Box id={headingId} sx={{ flex: 1, display: "flex", px: 0.5 }}>
                                <CategoryHeading category={category} />
                            </Box>
                            <Button
                                aria-label={fmt(words.addTo, {
                                    category: categoryName(category),
                                })}
                                color="neutral"
                                disabled={atLimit || busyId != null}
                                size="sm"
                                startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                                sx={{ "@media (pointer: coarse)": { minHeight: 44 } }}
                                variant="plain"
                                onClick={() => {
                                    setError(null);
                                    setAddingTo(category);
                                }}
                            >
                                {words.add}
                            </Button>
                        </Box>
                        <Box
                            aria-label={fmt(words.groupLabel, {
                                category: categoryName(category),
                            })}
                            component="ul"
                            sx={{
                                listStyle: "none",
                                m: 0,
                                p: 0,
                                border: `1px solid ${g.border.subtle}`,
                                borderRadius: g.radius.md,
                            }}
                        >
                            {group.map((row, index) => rowView(row, index, group.length))}
                            {(addingTo === category || busyId === `add:${category}`) && (
                                <Box component="li" sx={{ ...rowSx, paddingInlineStart: 6 }}>
                                    {busyId === `add:${category}` ? (
                                        <Spinner label={words.saving} />
                                    ) : (
                                        <NameInput
                                            initial=""
                                            label={words.nameLabel}
                                            onCancel={() => setAddingTo(null)}
                                            onSave={(name) => {
                                                setAddingTo(null);
                                                void save(`add:${category}`, () =>
                                                    createProjectStatus(
                                                        projectId,
                                                        { name, category },
                                                        accessToken
                                                    )
                                                );
                                            }}
                                        />
                                    )}
                                </Box>
                            )}
                        </Box>
                        {addError && (
                            <Box
                                role="alert"
                                sx={{ ...type("body-xs"), color: g.danger.text, px: 1, pt: 0.5 }}
                            >
                                {addError}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );

    const intro = () => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pb: 2 }}>
            <Box
                aria-hidden="true"
                data-testid="statuses-preview"
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    columnGap: 2.5,
                    rowGap: 1.5,
                    p: 2,
                    borderRadius: g.radius.md,
                    background: g.bg.subtle,
                }}
            >
                {/* The built-ins, before anything is written. */}
                {BUILTIN_STATUSES.map(({ key, category }) => (
                    <StatusLabel
                        key={key}
                        row={{ name: key, builtinKey: key, color: "", category }}
                        status={category}
                    />
                ))}
            </Box>
            <Box>
                <Box component="h3" sx={{ ...type("title-md"), m: 0, mb: 0.5 }}>
                    {words.introTitle}
                </Box>
                <Box sx={{ ...type("body-sm"), color: g.text.secondary }}>{words.introBody}</Box>
            </Box>
            {error?.at === "setup" && (
                <Alert color="danger" role="alert" size="sm" variant="soft">
                    {words.setUpFailed}
                </Alert>
            )}
            <Button
                loading={busyId === "setup"}
                sx={{
                    alignSelf: { xs: "stretch", sm: "flex-end" },
                    "@media (pointer: coarse)": { minHeight: 44 },
                }}
                onClick={() =>
                    void save("setup", () => reorderProjectStatuses(projectId, [], accessToken))
                }
            >
                {words.setUp}
            </Button>
        </Box>
    );

    const replacements = deleting
        ? rows.filter(
              (r) =>
                  r.category === deleting.row.category &&
                  r.statusId !== deleting.row.statusId &&
                  !r.isArchived
          )
        : [];

    const confirmDelete = async () => {
        if (!deleting) return;
        const { row, inUse, replacementId } = deleting;
        setBusyId(row.statusId);
        const result = await deleteProjectStatus(
            projectId,
            row.statusId,
            inUse == null ? null : replacementId,
            accessToken
        );
        setBusyId(null);
        if (result.ok) {
            setProjectStatuses(projectId, result.data);
            setDeleting(null);
            return;
        }
        if (result.code === "status_in_use") {
            const choices = rows.filter(
                (r) => r.category === row.category && r.statusId !== row.statusId && !r.isArchived
            );
            const preferred = choices.find((r) => r.isDefault) ?? choices[0];
            setDeleting({ row, inUse: result.inUse, replacementId: preferred?.statusId ?? null });
            return;
        }
        throw new Error(errorText(result.code));
    };

    return (
        <>
            <ModalFrame
                fullScreenOnMobile
                description={words.description}
                hostZIndex={hostZIndex}
                icon={<DonutLargeRoundedIcon sx={{ color: g.accent.text }} />}
                open={open}
                size="lg"
                title={words.title}
                onClose={onClose}
            >
                <Box aria-busy={busyId != null} data-testid="project-statuses">
                    {!entry.loaded ? (
                        <SkeletonRows count={6} label={words.title} />
                    ) : entry.failed ? (
                        <ErrorState
                            size="sm"
                            title={words.loadFailed}
                            onRetry={() => void refreshProjectStatuses(projectId, accessToken)}
                        />
                    ) : rows.length === 0 ? (
                        intro()
                    ) : (
                        groups()
                    )}
                </Box>
                <Box aria-live="polite" sx={srOnly}>
                    {announcement}
                </Box>
            </ModalFrame>
            <ConfirmDialog
                destructive
                cancelLabel={t.common.actions.cancel}
                confirmDisabled={deleting?.inUse != null && deleting.replacementId == null}
                confirmLabel={deleting?.inUse != null ? words.deleteAndMove : words.delete}
                description={
                    deleting?.inUse != null
                        ? replacements.length
                            ? fmt(words.deleteInUse, { count: deleting.inUse })
                            : words.noReplacement
                        : words.deleteBody
                }
                hostZIndex={layer}
                open={deleting != null}
                title={deleting ? fmt(words.deleteTitle, { name: nameOf(deleting.row) }) : ""}
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
            >
                {deleting?.inUse != null && replacements.length > 0 && (
                    <Select
                        slotProps={{
                            button: { "aria-label": words.replacementLabel },
                            listbox: { sx: { zIndex: layer + 20 } },
                        }}
                        renderValue={() => {
                            const picked = replacements.find(
                                (r) => r.statusId === deleting.replacementId
                            );
                            return picked ? (
                                <StatusLabel row={picked} status={picked.category} />
                            ) : null;
                        }}
                        value={deleting.replacementId}
                        onChange={(_e, value) =>
                            setDeleting((prev) =>
                                prev ? { ...prev, replacementId: value } : prev
                            )
                        }
                    >
                        {replacements.map((r) => (
                            <Option key={r.statusId} label={nameOf(r)} value={r.statusId}>
                                <StatusLabel row={r} status={r.category} />
                            </Option>
                        ))}
                    </Select>
                )}
            </ConfirmDialog>
        </>
    );
};
