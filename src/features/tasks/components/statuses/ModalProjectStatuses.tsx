import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
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
import ViewWeekRoundedIcon from "@mui/icons-material/ViewWeekRounded";
import { Alert, Box, Button, Chip, Input, Option, Select, Switch } from "@mui/joy";

import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { SkeletonRows, Spinner } from "../../../../components/ui/feedback/Skeleton";
import { TabStrip } from "../../../../components/ui/feedback/TabStrip";
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
import type { AutomationContextData } from "../../automation/lookups";
import { useAutomationPane } from "../../automation/useAutomationPane";
import {
    createProjectStatus,
    deleteProjectStatus,
    reorderProjectStatuses,
    setBoardColumnsPerStatus,
    StatusWriteResult,
    updateProjectStatus,
} from "../../services/projectStatuses";
import {
    BUILTIN_STATUSES,
    builtinName,
    MAX_STATUS_NAME,
    MAX_STATUSES,
    sortStatuses,
    STATUS_CATEGORIES,
    statusRowName,
} from "../../utils/projectStatus";
import { StatusLabel } from "../meta/StatusLabel";
import { rowSx, srOnly } from "./listStyles";
import { StatusColorMenu } from "./StatusColorMenu";
import { useCategoryName } from "./useCategoryName";

type Props = {
    projectId: number;
    open: boolean;
    onClose: () => void;
    /** The layer of the surface that opened this, when it is itself a dialog. */
    hostZIndex?: number;
    /** What the automation rules need (MIP-2499). Without it the dialog is the statuses alone. */
    automation?: AutomationContextData;
};

export type ProjectSettingsTab = "statuses" | "automation";

type Deleting = { row: ProjectStatusDef; inUse: number | null; replacementId: number | null };

const nameButtonSx = {
    ...type("body-md"),
    minWidth: 0,
    background: "none",
    border: 0,
    borderRadius: g.radius.sm,
    color: "inherit",
    cursor: "text",
    font: "inherit",
    textAlign: "start",
    pt: 0.5,
    pb: 0,
    px: 0.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "&:hover": { background: g.hover },
    "&:focus:not(:focus-visible)": { outline: "none" },
    "&:focus-visible": focusRing,
    "@media (pointer: coarse)": { minHeight: 36 },
} as const;

const NameInput = ({
    initial,
    label,
    describedBy,
    savingLabel,
    onSave,
    onCancel,
}: {
    savingLabel: string;
    initial: string;
    label: string;
    describedBy?: string;
    /** Resolves false when the save was refused: the field stays, with what was typed. */
    onSave: (name: string) => Promise<boolean>;
    onCancel: () => void;
}) => {
    const [value, setValue] = useState(initial);
    const [saving, setSaving] = useState(false);
    const done = useRef(false);
    const refused = useRef<string | null>(null);
    const finish = async (how: "enter" | "blur" | "escape") => {
        if (done.current) return;
        const name = value.trim();
        if (how === "escape" || !name || name === initial) {
            done.current = true;
            onCancel();
            return;
        }
        // Leaving a refused name alone does not send it again; Enter does.
        if (how === "blur" && name === refused.current) return;
        done.current = true;
        setSaving(true);
        if (await onSave(name)) return;
        refused.current = name;
        done.current = false;
        setSaving(false);
    };
    return (
        <Input
            placeholder={label}
            size="sm"
            sx={{ minWidth: 0 }}
            value={value}
            endDecorator={
                saving ? (
                    <Spinner label={savingLabel} />
                ) : value.length >= MAX_STATUS_NAME - 4 ? (
                    <Box component="span" sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                        {`${value.length}/${MAX_STATUS_NAME}`}
                    </Box>
                ) : null
            }
            slotProps={{
                input: {
                    "aria-label": label,
                    "aria-describedby": describedBy,
                    maxLength: MAX_STATUS_NAME,
                    enterKeyHint: "done",
                    readOnly: saving,
                },
            }}
            autoFocus
            onBlur={() => void finish("blur")}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void finish("enter");
                } else if (e.key === "Escape") {
                    // The dialog must not close with it.
                    e.preventDefault();
                    e.stopPropagation();
                    void finish("escape");
                }
            }}
        />
    );
};

const touchSx = { "@media (pointer: coarse)": { minHeight: 44 } } as const;

/** What a status counts as: the built-in state the rest of Genos reads it as. */
const CountsAsSelect = ({
    value,
    label,
    plain,
    zIndex,
    disabled,
    onChange,
}: {
    value: string;
    label: string;
    /** In a row: reads as the row's own detail line, not as a form field. */
    plain?: boolean;
    zIndex: number;
    disabled?: boolean;
    onChange: (category: string) => void;
}) => {
    const { t } = useTranslation();
    const categoryName = useCategoryName();
    return (
        <Select
            disabled={disabled}
            size="sm"
            value={value}
            variant={plain ? "plain" : "outlined"}
            renderValue={() =>
                fmt(t.tasks.projectStatuses.countsAs, { category: categoryName(value) })
            }
            slotProps={{
                button: { "aria-label": label },
                listbox: { sx: { zIndex } },
            }}
            sx={
                plain
                    ? {
                          ...type("body-xs"),
                          alignSelf: "flex-start",
                          fontWeight: 400,
                          color: g.text.secondary,
                          minHeight: 26,
                          px: 0.5,
                          py: 0,
                          gap: 0.25,
                          background: "transparent",
                          "--Select-decoratorColor": g.text.tertiary,
                          "@media (pointer: coarse)": { minHeight: 36 },
                      }
                    : { minWidth: 0, ...touchSx }
            }
            onChange={(_event, next) => {
                if (next && next !== value) onChange(next);
            }}
        >
            {STATUS_CATEGORIES.map((category) => (
                <Option key={category} value={category}>
                    {categoryName(category)}
                </Option>
            ))}
        </Select>
    );
};

/** A new status: its name, and what it counts as. */
const AddStatusForm = ({
    zIndex,
    describedBy,
    onSave,
    onCancel,
}: {
    zIndex: number;
    describedBy?: string;
    /** Resolves false when the save was refused: the form stays, with what was typed. */
    onSave: (name: string, category: string) => Promise<boolean>;
    onCancel: () => void;
}) => {
    const { t } = useTranslation();
    const words = t.tasks.projectStatuses;
    const [name, setName] = useState("");
    const [category, setCategory] = useState(STATUS_CATEGORIES[0]);
    const [saving, setSaving] = useState(false);
    // Read before the select handles the key and closes its own list.
    const listWasOpen = useRef(false);
    const submit = async () => {
        if (!name.trim() || saving) return;
        setSaving(true);
        if (!(await onSave(name.trim(), category))) setSaving(false);
    };
    return (
        <Box
            component="form"
            sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, p: 1 }}
            onKeyDown={(e: KeyboardEvent<HTMLFormElement>) => {
                if (e.key !== "Escape") return;
                // The dialog must not close with it; an open list closes alone.
                e.preventDefault();
                e.stopPropagation();
                if (!listWasOpen.current && !saving) onCancel();
            }}
            onKeyDownCapture={(e: KeyboardEvent<HTMLFormElement>) => {
                const target = e.target as HTMLElement;
                listWasOpen.current =
                    target.closest('[aria-expanded="true"], [role="listbox"]') != null;
            }}
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <Input
                placeholder={words.nameLabel}
                size="sm"
                sx={{ flex: "1 1 180px", minWidth: 0, ...touchSx }}
                value={name}
                endDecorator={
                    saving ? (
                        <Spinner label={words.saving} />
                    ) : name.length >= MAX_STATUS_NAME - 4 ? (
                        <Box component="span" sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                            {`${name.length}/${MAX_STATUS_NAME}`}
                        </Box>
                    ) : null
                }
                slotProps={{
                    input: {
                        "aria-label": words.nameLabel,
                        "aria-describedby": describedBy,
                        maxLength: MAX_STATUS_NAME,
                        enterKeyHint: "done",
                        readOnly: saving,
                    },
                }}
                autoFocus
                onChange={(e) => setName(e.target.value)}
            />
            <CountsAsSelect
                disabled={saving}
                label={words.countsAsNew}
                value={category}
                zIndex={zIndex}
                onChange={setCategory}
            />
            <Box sx={{ display: "flex", gap: 1, marginInlineStart: "auto" }}>
                <Button
                    color="neutral"
                    disabled={saving}
                    size="sm"
                    sx={touchSx}
                    type="button"
                    variant="plain"
                    onClick={onCancel}
                >
                    {t.common.actions.cancel}
                </Button>
                <Button
                    disabled={!name.trim()}
                    loading={saving}
                    size="sm"
                    sx={touchSx}
                    type="submit"
                >
                    {words.add}
                </Button>
            </Box>
        </Box>
    );
};

/**
 * A project's statuses (MIP-2493): one ordered list where the team renames, recolours, adds,
 * orders, turns off and deletes, each saying what it counts as (MIP-2590: the built-in state
 * filters, overdue and automations read). Every action saves at once.
 */
export const ModalProjectStatuses = ({
    projectId,
    open,
    onClose,
    hostZIndex,
    automation,
}: Props) => {
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
    const [adding, setAdding] = useState(false);
    const [deleting, setDeleting] = useState<Deleting | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const [tab, setTab] = useState<ProjectSettingsTab>("statuses");
    const rules = useAutomationPane({
        projectId,
        data: automation,
        active: open,
        popupZ: layer + 10,
        onLeave: onClose,
    });
    const onRules = automation != null && tab === "automation";
    const panelA11y =
        automation && !(onRules && rules.subView)
            ? {
                  role: "tabpanel",
                  "aria-label": onRules
                      ? t.tasks.automation.tabAutomation
                      : t.tasks.automation.tabStatuses,
              }
            : {};

    // A teammate may have changed the list since it was first read.
    useEffect(() => {
        if (open) void refreshProjectStatuses(projectId, accessToken);
        else {
            setTab("statuses");
            setError(null);
            setEditingId(null);
            setAdding(false);
            setDeleting(null);
        }
    }, [open, projectId, accessToken]);

    const errorText = (code: string, inUse = 0) =>
        code === "status_in_use"
            ? fmt(words.countsAsInUse, { count: inUse })
            : code === "status_in_rules"
              ? words.countsAsInRules
              : code === "name_taken"
                ? words.nameTaken
                : code === "name_reserved"
                  ? words.nameReserved
                  : code === "name_too_long"
                    ? fmt(words.nameTooLong, { max: MAX_STATUS_NAME })
                    : code === "name_required"
                      ? words.nameEmpty
                      : words.saveFailed;

    // One write at a time, in the order asked for: every answer is the whole list, so an
    // earlier one arriving late must not win.
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const queued = useRef(0);
    const enqueue = (
        at: number | string,
        write: () => Promise<StatusWriteResult>
    ): Promise<StatusWriteResult> => {
        queued.current += 1;
        setBusyId(at);
        const run = queue.current.then(write).then((result) => {
            queued.current -= 1;
            if (queued.current === 0) setBusyId(null);
            if (result.ok) setProjectStatuses(projectId, result.data);
            return result;
        });
        queue.current = run.catch(() => undefined);
        return run;
    };

    const save = async (
        at: number | string,
        write: () => Promise<StatusWriteResult>
    ): Promise<StatusWriteResult> => {
        setError(null);
        const result = await enqueue(at, write);
        if (!result.ok) setError({ at, text: errorText(result.code, result.inUse) });
        return result;
    };

    // The row or button that had the focus was moved or removed: give it somewhere to be.
    const body = useRef<HTMLDivElement>(null);
    const focusLater = (selector: string) =>
        window.setTimeout(() => {
            const active = document.activeElement;
            const lost = !active || active === document.body || active.matches('[role="dialog"]');
            if (lost) body.current?.querySelector<HTMLElement>(selector)?.focus();
        }, 100);
    const nameSelector = (id: number) => `[data-status-id="${id}"] [data-testid="status-name"]`;
    const menuSelector = (id: number) => `[data-status-menu="${id}"] button`;

    const nameOf = (row: ProjectStatusDef) => statusRowName(row, t.tasks);

    // The list is ordered by what each status counts as, as the board's columns are, so a
    // status moves among the ones that count as the same.
    const canMove = (from: number, step: -1 | 1) =>
        rows[from + step] != null && rows[from + step].category === rows[from]?.category;

    const move = async (row: ProjectStatusDef, step: -1 | 1) => {
        const from = rows.findIndex((r) => r.statusId === row.statusId);
        if (!canMove(from, step) || busyId != null) return;
        const to = from + step;
        const ids = rows.map((r) => r.statusId);
        [ids[from], ids[to]] = [ids[to], ids[from]];
        const result = await save(row.statusId, () =>
            reorderProjectStatuses(projectId, ids, accessToken)
        );
        if (result.ok) {
            focusLater(menuSelector(row.statusId));
            setAnnouncement(
                fmt(words.moved, {
                    name: nameOf(row),
                    position: to + 1,
                    total: rows.length,
                })
            );
        }
    };

    const patch = (row: ProjectStatusDef, change: Parameters<typeof updateProjectStatus>[2]) =>
        save(row.statusId, () =>
            updateProjectStatus(projectId, row.statusId, change, accessToken)
        );

    const recount = async (row: ProjectStatusDef, category: string) => {
        const result = await patch(row, { category });
        focusLater(`[data-status-id="${row.statusId}"] [role="combobox"]`);
        if (result.ok) {
            setAnnouncement(
                fmt(words.countsAsChanged, {
                    name: nameOf(row),
                    category: categoryName(category),
                })
            );
        }
    };

    const menuFor = (row: ProjectStatusDef, index: number): MoreMenuItem[] => [
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
            visible: canMove(index, -1),
            onClick: () => void move(row, -1),
        },
        {
            id: "down",
            label: words.moveDown,
            icon: <ArrowDownwardRoundedIcon />,
            visible: canMove(index, 1),
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

    /** The other statuses that are on and count as the same. */
    const sameCategory = (row: ProjectStatusDef) =>
        rows.filter(
            (r) => r.category === row.category && r.statusId !== row.statusId && !r.isArchived
        ).length;

    const rowView = (row: ProjectStatusDef, index: number) => {
        const name = nameOf(row);
        const failed = error?.at === row.statusId ? error.text : null;
        return (
            <Box
                key={row.statusId}
                component="li"
                data-status-id={row.statusId}
                sx={{ "&:not(:first-of-type)": rowSx["&:not(:first-of-type)"] }}
            >
                <Box
                    sx={{ ...rowSx, "&:not(:first-of-type)": undefined }}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                        // In the name field and the "Counts as" select the arrows are theirs.
                        const target = e.target as HTMLElement;
                        if (target.closest('input, [role="combobox"], [role="listbox"]')) return;
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
                    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        {editingId === row.statusId ? (
                            <NameInput
                                describedBy={failed ? errorId : undefined}
                                initial={name}
                                label={words.nameLabel}
                                savingLabel={words.saving}
                                onCancel={() => {
                                    setEditingId(null);
                                    setError(null);
                                    focusLater(nameSelector(row.statusId));
                                }}
                                onSave={async (next) => {
                                    const result = await patch(row, { name: next });
                                    if (!result.ok) return false;
                                    setEditingId(null);
                                    focusLater(nameSelector(row.statusId));
                                    return true;
                                }}
                            />
                        ) : (
                            <Box
                                component="button"
                                data-testid="status-name"
                                title={name}
                                type="button"
                                sx={{
                                    ...nameButtonSx,
                                    color: row.isArchived ? g.text.tertiary : g.text.primary,
                                }}
                                onClick={() => setEditingId(row.statusId)}
                            >
                                {name}
                            </Box>
                        )}
                        {row.builtinKey ? (
                            <Box
                                sx={{
                                    ...type("body-xs"),
                                    color: g.text.tertiary,
                                    px: 0.5,
                                    pb: 0.5,
                                }}
                            >
                                {fmt(words.countsAs, { category: categoryName(row.category) })}
                            </Box>
                        ) : (
                            <CountsAsSelect
                                disabled={busyId != null}
                                label={fmt(words.countsAsLabel, { name })}
                                value={row.category}
                                zIndex={layer + 10}
                                plain
                                onChange={(category) => void recount(row, category)}
                            />
                        )}
                    </Box>
                    {busyId === row.statusId ? (
                        <Spinner label={words.saving} />
                    ) : (
                        <>
                            {/* "Default" only means something where there is a choice. */}
                            {row.isDefault && sameCategory(row) > 0 && (
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
                        title={row.canDelete ? undefined : words.builtinHint}
                        sx={{
                            display: "inline-flex",
                            width: 14,
                            flexShrink: 0,
                            color: g.text.tertiary,
                        }}
                    >
                        {!row.canDelete && <LockOutlinedIcon sx={{ fontSize: 14 }} />}
                    </Box>
                    <Box
                        data-status-menu={row.statusId}
                        sx={{
                            "@media (pointer: coarse)": { "& button": { width: 44, height: 44 } },
                        }}
                    >
                        <MoreMenu
                            ariaLabel={fmt(words.moreActions, { name })}
                            items={menuFor(row, index)}
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

    // "One column per status" (MIP-2495): shown as picked while it is being saved, and put
    // back by the stored value if the save fails.
    const [pendingBoard, setPendingBoard] = useState<boolean | null>(null);
    const boardPerStatus = pendingBoard ?? entry.boardColumnsPerStatus === true;
    const toggleBoard = async (on: boolean) => {
        setPendingBoard(on);
        const result = await save("board", () =>
            setBoardColumnsPerStatus(projectId, on, accessToken)
        );
        setPendingBoard(null);
        if (result.ok) {
            setAnnouncement(on ? words.boardColumnsOn : words.boardColumnsOff);
        }
    };

    // The whole row is the switch's label.
    const boardOption = () => (
        <Box>
            <Box
                component="label"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    minHeight: 44,
                    px: 1.5,
                    py: 1,
                    border: `1px solid ${g.border.subtle}`,
                    borderRadius: g.radius.md,
                    cursor: "pointer",
                }}
            >
                <ViewWeekRoundedIcon
                    aria-hidden="true"
                    sx={{ fontSize: 16, color: g.text.secondary, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                        id={`${errorId}-board`}
                        sx={{ ...type("body-md"), color: g.text.primary }}
                    >
                        {words.boardColumnsTitle}
                    </Box>
                    <Box
                        id={`${errorId}-board-hint`}
                        sx={{ ...type("body-xs"), color: g.text.tertiary }}
                    >
                        {words.boardColumnsHint}
                    </Box>
                </Box>
                <Switch
                    checked={boardPerStatus}
                    disabled={pendingBoard != null}
                    size="sm"
                    slotProps={{
                        input: {
                            role: "switch",
                            "aria-labelledby": `${errorId}-board`,
                            "aria-describedby": `${errorId}-board-hint`,
                        },
                    }}
                    onChange={(event) => void toggleBoard(event.target.checked)}
                />
            </Box>
            {error?.at === "board" && (
                <Box
                    role="alert"
                    sx={{ ...type("body-xs"), color: g.danger.text, px: 1, pt: 0.5 }}
                >
                    {error.text}
                </Box>
            )}
        </Box>
    );

    const addError = error?.at === "add" ? error.text : null;
    const closeAdd = () => {
        setAdding(false);
        setError(null);
        focusLater("[data-add-status]");
    };

    const list = () => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
            {boardOption()}
            <Box sx={{ ...type("body-xs"), color: g.text.tertiary, px: 0.5, mt: 0.5 }}>
                {words.countsAsHint}
            </Box>
            <Box
                aria-label={words.title}
                component="ul"
                sx={{
                    listStyle: "none",
                    m: 0,
                    p: 0,
                    border: `1px solid ${g.border.subtle}`,
                    borderRadius: g.radius.md,
                }}
            >
                {rows.map(rowView)}
                {adding && (
                    <Box component="li" sx={{ borderTop: `1px solid ${g.border.subtle}` }}>
                        <AddStatusForm
                            describedBy={addError ? errorId : undefined}
                            zIndex={layer + 10}
                            onCancel={closeAdd}
                            onSave={async (name, category) => {
                                const result = await save("add", () =>
                                    createProjectStatus(projectId, { name, category }, accessToken)
                                );
                                if (!result.ok) return false;
                                closeAdd();
                                return true;
                            }}
                        />
                    </Box>
                )}
            </Box>
            {addError && (
                <Box
                    id={errorId}
                    role="alert"
                    sx={{ ...type("body-xs"), color: g.danger.text, px: 1, mt: -1 }}
                >
                    {addError}
                </Box>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Button
                    color="neutral"
                    data-add-status=""
                    disabled={atLimit}
                    size="sm"
                    startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={touchSx}
                    variant="plain"
                    onClick={() => {
                        setError(null);
                        setAdding(true);
                    }}
                >
                    {words.addStatus}
                </Button>
                <Box
                    sx={{
                        ...type("body-xs"),
                        color: atLimit ? g.warning.text : g.text.tertiary,
                        marginInlineStart: "auto",
                        textAlign: "end",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {atLimit
                        ? fmt(words.limitHint, { max: MAX_STATUSES })
                        : fmt(words.count, { n: rows.length, max: MAX_STATUSES })}
                </Box>
            </Box>
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
                        row={{ name: builtinName(key), builtinKey: key, color: "", category }}
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
        // Where the focus goes once the row is gone: its neighbour, else Add.
        const at = rows.findIndex((r) => r.statusId === row.statusId);
        const neighbour = rows[at + 1] ?? rows[at - 1];
        const result = await enqueue(row.statusId, () =>
            deleteProjectStatus(
                projectId,
                row.statusId,
                inUse == null ? null : replacementId,
                accessToken
            )
        );
        if (result.ok) {
            setDeleting(null);
            focusLater(neighbour ? menuSelector(neighbour.statusId) : "[data-add-status]");
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
                actions={onRules ? rules.actions : undefined}
                description={onRules ? t.tasks.automation.description : words.description}
                hostZIndex={hostZIndex}
                icon={<DonutLargeRoundedIcon sx={{ color: g.accent.text }} />}
                open={open}
                size="lg"
                title={automation ? words.menuItem : words.title}
                fullScreenOnMobile
                // An unsaved rule is asked about first.
                onClose={() => rules.guard(onClose)}
            >
                {automation && (
                    <Box
                        sx={{
                            position: "sticky",
                            top: "-8px",
                            zIndex: 2,
                            background: g.surface.raised,
                            mt: -1,
                            mb: 1.5,
                        }}
                    >
                        {onRules && rules.subView ? (
                            rules.backRow
                        ) : (
                            <TabStrip
                                ariaLabel={t.tasks.automation.tabsLabel}
                                size="sm"
                                value={tab}
                                tabs={[
                                    {
                                        id: "statuses",
                                        label: t.tasks.automation.tabStatuses,
                                        panelId: "project-settings-panel",
                                    },
                                    {
                                        id: "automation",
                                        label: (
                                            <>
                                                {t.tasks.automation.tabAutomation}
                                                {rules.needsFix > 0 && (
                                                    <Box component="span" sx={srOnly}>
                                                        {fmt(t.tasks.automation.needsFixTitle, {
                                                            n: rules.needsFix,
                                                        })}
                                                    </Box>
                                                )}
                                            </>
                                        ),
                                        panelId: "project-settings-panel",
                                        count: rules.needsFix,
                                        attention: true,
                                        title: rules.needsFix
                                            ? fmt(t.tasks.automation.needsFixTitle, {
                                                  n: rules.needsFix,
                                              })
                                            : undefined,
                                    },
                                ]}
                                onChange={(id) => setTab(id as ProjectSettingsTab)}
                            />
                        )}
                    </Box>
                )}
                {/* The dialog must not jump in height between the tabs, and past the list
                    the tabs are gone, and with them the panel. */}
                <Box
                    id={automation ? "project-settings-panel" : undefined}
                    sx={automation ? { minHeight: { sm: 420 } } : undefined}
                    {...panelA11y}
                >
                    {onRules ? (
                        rules.body
                    ) : (
                        <Box ref={body} aria-busy={busyId != null} data-testid="project-statuses">
                            {!entry.loaded ? (
                                <SkeletonRows count={6} label={words.title} />
                            ) : entry.failed ? (
                                <ErrorState
                                    size="sm"
                                    title={words.loadFailed}
                                    onRetry={() =>
                                        void refreshProjectStatuses(projectId, accessToken)
                                    }
                                />
                            ) : rows.length === 0 ? (
                                intro()
                            ) : (
                                list()
                            )}
                        </Box>
                    )}
                </Box>
                <Box aria-live="polite" sx={srOnly}>
                    {onRules ? rules.announcement : announcement}
                </Box>
            </ModalFrame>
            {rules.dialogs}
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmDisabled={deleting?.inUse != null && deleting.replacementId == null}
                confirmLabel={deleting?.inUse != null ? words.deleteAndMove : words.delete}
                hostZIndex={layer}
                open={deleting != null}
                title={deleting ? fmt(words.deleteTitle, { name: nameOf(deleting.row) }) : ""}
                description={
                    deleting?.inUse != null
                        ? replacements.length
                            ? fmt(words.deleteInUse, { count: deleting.inUse })
                            : fmt(words.noReplacement, {
                                  category: categoryName(deleting.row.category),
                              })
                        : words.deleteBody
                }
                destructive
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
            >
                {deleting?.inUse != null && replacements.length > 0 && (
                    <Select
                        value={deleting.replacementId}
                        renderValue={() => {
                            const picked = replacements.find(
                                (r) => r.statusId === deleting.replacementId
                            );
                            return picked ? (
                                <StatusLabel row={picked} status={picked.category} />
                            ) : null;
                        }}
                        slotProps={{
                            button: { "aria-label": words.replacementLabel },
                            listbox: { sx: { zIndex: layer + 20 } },
                        }}
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
