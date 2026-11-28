/**
 * The "Quick actions" tab of the project's "Statuses and automation" dialog (MIP-2603): one
 * ordered list of "before → after, title, on or off" that the preview headers turn into
 * buttons. Every action saves at once, as the statuses beside it do.
 */
import { CSSProperties, KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { Alert, Box, Button, Input, Switch } from "@mui/joy";
import { createPortal } from "react-dom";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { SkeletonRows, Spinner } from "../../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { useAuth } from "../../../../context/authState";
import {
    refreshProjectStatusActions,
    setProjectStatusActions,
    useProjectStatusActions,
} from "../../../../hooks/tasks/useProjectStatusActions";
import { fmt, useTranslation } from "../../../../i18n";
import { focusRing, g, type } from "../../../../theme/tokens";
import { ProjectStatusAction, ProjectStatusDef, TaskProps } from "../../../../types/tasks";
import {
    ActionInput,
    ActionWriteResult,
    createProjectStatusAction,
    deleteProjectStatusAction,
    reorderProjectStatusActions,
    updateProjectStatusAction,
} from "../../services/projectStatusActions";
import { builtinName, statusRowName } from "../../utils/projectStatus";
import {
    actionRow,
    actionTitle,
    defaultActionTitle,
    MAX_ACTION_TITLE,
    MAX_ACTIONS,
    pairDefaultKey,
} from "../../utils/quickActions";
import { statuses as statusMetas } from "../../utils/taskMeta";
import { ACTaskStatus } from "../autocompletes/ACTaskStatus";
import { StatusLabel } from "../meta/StatusLabel";
import { rowSx, srOnly } from "./listStyles";

type Props = {
    projectId: number;
    /** The project's statuses in the editor's order; empty until it sets them up. */
    rows: ProjectStatusDef[];
    /** The layer of the dialog this sits in. */
    layer: number;
    /** The set-up of the statuses tab, for a project that has none. */
    onSetUp: () => void;
    settingUp: boolean;
    setUpFailed: boolean;
};

const touchSx = { "@media (pointer: coarse)": { minHeight: 44 } } as const;

const listSx = {
    listStyle: "none",
    m: 0,
    p: 0,
    border: `1px solid ${g.border.subtle}`,
    borderRadius: g.radius.md,
} as const;

const detailSx = { ...type("body-xs"), color: g.text.tertiary } as const;

/** One side of an action: the row it names, or the built-in a computed default stands for. */
const Side = ({ row, builtinKey }: { row?: ProjectStatusDef; builtinKey: string | null }) =>
    row ? (
        <StatusLabel row={row} status={row.category} />
    ) : builtinKey ? (
        <StatusLabel
            row={{ name: builtinName(builtinKey), builtinKey, color: "", category: builtinKey }}
            status={builtinKey}
        />
    ) : null;

const Pair = ({
    action,
    rows,
}: {
    action: ProjectStatusAction;
    rows: readonly ProjectStatusDef[];
}) => {
    const { t } = useTranslation();
    const before = actionRow(rows, action.beforeStatusId, action.beforeKey);
    const after = actionRow(rows, action.afterStatusId, action.afterKey);
    const name = (row: ProjectStatusDef | undefined, key: string | null) =>
        row
            ? statusRowName(row, t.tasks)
            : (t.tasks.filters as Record<string, string>)[(key ?? "").toLowerCase()];
    return (
        <>
            <Box component="span" sx={srOnly}>
                {fmt(t.tasks.quickActions.pair, {
                    before: name(before, action.beforeKey),
                    after: name(after, action.afterKey),
                })}
            </Box>
            <Box
                aria-hidden="true"
                component="span"
                sx={{
                    display: "inline-flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    columnGap: 0.75,
                    minWidth: 0,
                }}
            >
                <Side builtinKey={action.beforeKey} row={before} />
                <ArrowForwardRoundedIcon
                    sx={{
                        fontSize: 14,
                        color: g.text.tertiary,
                        '[dir="rtl"] &': { transform: "scaleX(-1)" },
                    }}
                />
                <Side builtinKey={action.afterKey} row={after} />
            </Box>
        </>
    );
};

type Draft = { beforeId: number | null; afterId: number | null; title: string };

/** Add or edit one action. */
const ActionForm = ({
    projectId,
    rows,
    initial,
    submitLabel,
    onSave,
    onCancel,
}: {
    projectId: number;
    rows: ProjectStatusDef[];
    initial: Draft;
    submitLabel: string;
    /** Resolves to the refusal's words, or null when saved. */
    onSave: (input: ActionInput) => Promise<string | null>;
    onCancel: () => void;
}) => {
    const { t } = useTranslation();
    const words = t.tasks.quickActions;
    const [draft, setDraft] = useState<Draft>(initial);
    const [saving, setSaving] = useState(false);
    const [refusal, setRefusal] = useState<string | null>(null);
    const listWasOpen = useRef(false);
    const id = useId();

    const rowOf = (statusId: number | null) => rows.find((r) => r.statusId === statusId);
    const before = rowOf(draft.beforeId);
    const after = rowOf(draft.afterId);
    const defaultKey = pairDefaultKey(before?.builtinKey, after?.builtinKey);
    const fallback = defaultActionTitle(defaultKey, "task", t.tasks.preview);

    const change = (next: Partial<Draft>) => {
        setRefusal(null);
        setDraft((previous) => ({ ...previous, ...next }));
    };

    const submit = async () => {
        if (saving || draft.beforeId == null || draft.afterId == null) return;
        const title = draft.title.trim();
        if (draft.beforeId === draft.afterId) return setRefusal(words.sameStatus);
        if (!title && !defaultKey) return setRefusal(words.titleRequired);
        setSaving(true);
        const refused = await onSave({
            before_status_id: draft.beforeId,
            after_status_id: draft.afterId,
            title: title || null,
        });
        if (refused == null) return;
        setRefusal(refused);
        setSaving(false);
    };

    const picker = (side: "beforeId" | "afterId", label: string) => {
        const row = rowOf(draft[side]);
        return (
            <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
                <Box aria-hidden="true" sx={{ ...detailSx, mb: 0.25 }}>
                    {label}
                </Box>
                <Box
                    sx={{
                        "& .MuiAutocomplete-root": { width: "100%" },
                        "@media (pointer: coarse)": {
                            "& .MuiAutocomplete-root": { minHeight: 44 },
                        },
                    }}
                >
                    {/* The task view's own status picker, on a stand-in that holds one value. */}
                    <ACTaskStatus
                        field={{ label, slotId: `quick-${side}` }}
                        setTaskContent={(next) => change({ [side]: next.customStatusPick })}
                        socket={null}
                        taskContent={
                            {
                                id: `${id}-${side}`,
                                project: { projectId },
                                status: statusMetas.find((s) => s.status === row?.category) ?? {
                                    status: "",
                                },
                                customStatusId: row?.statusId ?? null,
                            } as unknown as TaskProps
                        }
                    />
                </Box>
            </Box>
        );
    };

    return (
        <Box
            aria-label={submitLabel}
            component="form"
            sx={{ display: "flex", flexDirection: "column", gap: 1.25, p: 1.5 }}
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
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {picker("beforeId", words.from)}
                {picker("afterId", words.to)}
            </Box>
            <Box>
                <Box aria-hidden="true" sx={{ ...detailSx, mb: 0.25 }}>
                    {words.titleLabel}
                </Box>
                <Input
                    size="sm"
                    sx={{ minWidth: 0, ...touchSx }}
                    value={draft.title}
                    endDecorator={
                        draft.title.length >= MAX_ACTION_TITLE - 4 ? (
                            <Box component="span" sx={detailSx}>
                                {`${draft.title.length}/${MAX_ACTION_TITLE}`}
                            </Box>
                        ) : null
                    }
                    placeholder={
                        fallback ? fmt(words.titlePlaceholder, { title: fallback }) : undefined
                    }
                    slotProps={{
                        input: {
                            "aria-label": words.titleLabel,
                            "aria-describedby": refusal ? `${id}-refusal` : undefined,
                            maxLength: MAX_ACTION_TITLE,
                            enterKeyHint: "done",
                            readOnly: saving,
                        },
                    }}
                    onChange={(e) => change({ title: e.target.value })}
                />
                {draft.title.trim() !== "" && defaultKey && (
                    <Button
                        color="neutral"
                        disabled={saving}
                        size="sm"
                        startDecorator={<ReplayRoundedIcon sx={{ fontSize: 14 }} />}
                        sx={{ mt: 0.5, ...touchSx }}
                        type="button"
                        variant="plain"
                        onClick={() => change({ title: "" })}
                    >
                        {words.resetTitle}
                    </Button>
                )}
            </Box>
            {refusal && (
                <Box
                    id={`${id}-refusal`}
                    role="alert"
                    sx={{ ...type("body-xs"), color: g.danger.text }}
                >
                    {refusal}
                </Box>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
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
                    disabled={draft.beforeId == null || draft.afterId == null}
                    loading={saving}
                    size="sm"
                    sx={touchSx}
                    type="submit"
                >
                    {submitLabel}
                </Button>
            </Box>
        </Box>
    );
};

export const QuickActionsPane = ({
    projectId,
    rows,
    layer,
    onSetUp,
    settingUp,
    setUpFailed,
}: Props) => {
    const { t } = useTranslation();
    const words = t.tasks.quickActions;
    const { accessToken } = useAuth();
    const entry = useProjectStatusActions(projectId, accessToken);
    const actions = entry.actions;

    /** An action's id, or "add" for the new one. */
    const [editing, setEditing] = useState<number | "add" | null>(null);
    const [deleting, setDeleting] = useState<ProjectStatusAction | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<{ at: number; text: string } | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const body = useRef<HTMLDivElement>(null);

    // A teammate may have changed the list since it was first read, and a set-up gives the
    // computed defaults their rows.
    const hasRows = rows.length > 0;
    useEffect(() => {
        void refreshProjectStatusActions(projectId, accessToken, { afterChange: true });
    }, [projectId, accessToken, hasRows]);
    // Set up, but the list in hand is still the computed one: its rows are not read yet.
    const awaitingRows = hasRows && actions.some((a) => a.actionId == null);
    const unreadable = entry.failed && (awaitingRows || actions.length === 0);

    const errorText = (code: string) =>
        code === "duplicate"
            ? words.duplicate
            : code === "same_status"
              ? words.sameStatus
              : code === "title_required"
                ? words.titleRequired
                : code === "title_too_long"
                  ? fmt(words.titleTooLong, { max: MAX_ACTION_TITLE })
                  : code === "archived"
                    ? words.statusOff
                    : code === "too_many"
                      ? fmt(words.limitHint, { max: MAX_ACTIONS })
                      : words.saveFailed;

    // One write at a time, in the order asked for: every answer is the whole list.
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const enqueue = (write: () => Promise<ActionWriteResult>): Promise<ActionWriteResult> => {
        const run = queue.current.then(write).then((result) => {
            if (result.ok) setProjectStatusActions(projectId, result.data);
            return result;
        });
        queue.current = run.catch(() => undefined);
        return run;
    };

    const save = async (at: number, write: () => Promise<ActionWriteResult>) => {
        setError(null);
        setBusyId(at);
        const result = await enqueue(write);
        setBusyId(null);
        if (!result.ok) setError({ at, text: errorText(result.code) });
        return result;
    };

    const focusLater = (selector: string) =>
        window.setTimeout(() => {
            const active = document.activeElement;
            const lost = !active || active === document.body || active.matches('[role="dialog"]');
            if (lost) body.current?.querySelector<HTMLElement>(selector)?.focus();
        }, 100);
    const titleSelector = (id: number) => `[data-action-id="${id}"] [data-testid="action-title"]`;
    const menuSelector = (id: number) => `[data-action-menu="${id}"] button`;

    const titleOf = (action: ProjectStatusAction) => actionTitle(action, "task", t.tasks.preview);

    const move = async (from: number, to: number) => {
        const action = actions[from];
        if (!action?.actionId || to < 0 || to >= actions.length || from === to) return;
        const next = [...actions];
        next.splice(from, 1);
        next.splice(to, 0, action);
        // Shown where it was dropped; a refusal reads the stored order back.
        setProjectStatusActions(projectId, { ...entry, actions: next });
        const result = await save(action.actionId, () =>
            reorderProjectStatusActions(
                projectId,
                next.flatMap((a) => a.actionId ?? []),
                accessToken
            )
        );
        if (!result.ok) {
            void refreshProjectStatusActions(projectId, accessToken, { afterChange: true });
            return;
        }
        focusLater(menuSelector(action.actionId));
        setAnnouncement(
            fmt(words.moved, { title: titleOf(action), position: to + 1, total: next.length })
        );
    };

    const onDragEnd = ({ source, destination }: DropResult) => {
        if (destination) void move(source.index, destination.index);
    };

    const closeForm = (focus: string) => {
        setEditing(null);
        focusLater(focus);
    };

    const menuFor = (action: ProjectStatusAction, index: number): MoreMenuItem[] => [
        {
            id: "edit",
            label: words.edit,
            icon: <DriveFileRenameOutlineRoundedIcon />,
            // After the menu has handed focus back to its trigger, or the field loses it.
            onClick: () => window.setTimeout(() => setEditing(action.actionId), 0),
        },
        {
            id: "up",
            label: words.moveUp,
            icon: <ArrowUpwardRoundedIcon />,
            visible: index > 0,
            onClick: () => void move(index, index - 1),
        },
        {
            id: "down",
            label: words.moveDown,
            icon: <ArrowDownwardRoundedIcon />,
            visible: index < actions.length - 1,
            onClick: () => void move(index, index + 1),
        },
        {
            id: "reset",
            label: words.resetTitle,
            icon: <ReplayRoundedIcon />,
            visible: action.title != null && action.defaultKey != null,
            onClick: () =>
                void save(action.actionId!, () =>
                    updateProjectStatusAction(
                        projectId,
                        action.actionId!,
                        { title: null },
                        accessToken
                    )
                ),
        },
        {
            id: "delete",
            label: words.delete,
            icon: <DeleteOutlineRoundedIcon />,
            danger: true,
            onClick: () => setDeleting(action),
        },
    ];

    const isShown = (action: ProjectStatusAction) =>
        [
            actionRow(rows, action.beforeStatusId, action.beforeKey),
            actionRow(rows, action.afterStatusId, action.afterKey),
        ].every((row) => row != null && !row.isArchived);

    const rowBody = (action: ProjectStatusAction, index: number, handle: React.ReactNode) => {
        const id = action.actionId!;
        const title = titleOf(action);
        const shown = isShown(action);
        const failed = error?.at === id ? error.text : null;
        return (
            <>
                <Box
                    sx={{ ...rowSx, "&:not(:first-of-type)": undefined, py: 0.5, gap: 0.5 }}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                        e.preventDefault();
                        void move(index, index + (e.key === "ArrowUp" ? -1 : 1));
                    }}
                >
                    {handle}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
                            <Box
                                component="button"
                                data-testid="action-title"
                                title={title}
                                type="button"
                                sx={{
                                    ...type("body-md"),
                                    minWidth: 0,
                                    background: "none",
                                    border: 0,
                                    borderRadius: g.radius.sm,
                                    cursor: "pointer",
                                    font: "inherit",
                                    textAlign: "start",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    px: 0.5,
                                    py: 0,
                                    color:
                                        action.enabled && shown ? g.text.primary : g.text.tertiary,
                                    "&:hover": { background: g.hover },
                                    "&:focus:not(:focus-visible)": { outline: "none" },
                                    "&:focus-visible": focusRing,
                                    "@media (pointer: coarse)": { minHeight: 32 },
                                }}
                                onClick={() => setEditing(id)}
                            >
                                {title}
                            </Box>
                            {action.title != null && (
                                <Box component="span" sx={{ ...detailSx, flexShrink: 0 }}>
                                    {words.customTitle}
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ ...type("body-xs"), px: 0.5, pb: 0.25 }}>
                            <Pair action={action} rows={rows} />
                        </Box>
                        {!shown && <Box sx={{ ...detailSx, px: 0.5 }}>{words.notShown}</Box>}
                    </Box>
                    {busyId === id && <Spinner label={t.tasks.projectStatuses.saving} />}
                    <Box
                        component="label"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 36,
                            flexShrink: 0,
                            cursor: "pointer",
                            "@media (pointer: coarse)": { minWidth: 44, minHeight: 44 },
                        }}
                    >
                        <Switch
                            checked={action.enabled}
                            disabled={busyId === id}
                            size="sm"
                            slotProps={{
                                input: {
                                    role: "switch",
                                    "aria-label": fmt(words.showAction, { title }),
                                },
                            }}
                            onChange={(e) => {
                                // Read now: the save runs after React puts the value back.
                                const enabled = e.target.checked;
                                void save(id, () =>
                                    updateProjectStatusAction(
                                        projectId,
                                        id,
                                        { enabled },
                                        accessToken
                                    )
                                );
                            }}
                        />
                    </Box>
                    <Box
                        data-action-menu={id}
                        sx={{
                            "@media (pointer: coarse)": { "& button": { width: 44, height: 44 } },
                        }}
                    >
                        <MoreMenu
                            ariaLabel={fmt(words.moreActions, { title })}
                            items={menuFor(action, index)}
                            placement="bottom-end"
                            triggerSize={32}
                            zIndex={layer + 10}
                        />
                    </Box>
                </Box>
                {failed && (
                    <Box role="alert" sx={{ ...type("body-xs"), color: g.danger.text, px: 2 }}>
                        {failed}
                    </Box>
                )}
            </>
        );
    };

    const editForm = (action: ProjectStatusAction) => (
        <ActionForm
            projectId={projectId}
            rows={rows}
            submitLabel={words.save}
            initial={{
                beforeId: action.beforeStatusId,
                afterId: action.afterStatusId,
                title: action.title ?? "",
            }}
            onCancel={() => closeForm(titleSelector(action.actionId!))}
            onSave={async (input) => {
                const result = await enqueue(() =>
                    updateProjectStatusAction(projectId, action.actionId!, input, accessToken)
                );
                if (!result.ok) return errorText(result.code);
                closeForm(titleSelector(action.actionId!));
                return null;
            }}
        />
    );

    const item = (action: ProjectStatusAction, index: number) => {
        const id = action.actionId!;
        return (
            <Draggable
                key={id}
                draggableId={String(id)}
                index={index}
                isDragDisabled={editing != null || busyId != null}
            >
                {(provided, snapshot) => {
                    const node = (
                        <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            component={snapshot.isDragging ? "div" : "li"}
                            data-action-id={id}
                            style={
                                {
                                    ...provided.draggableProps.style,
                                    // Above the dialog it was lifted out of.
                                    ...(snapshot.isDragging && { zIndex: layer + 10 }),
                                } as CSSProperties
                            }
                            sx={{
                                "&:not(:first-of-type)": {
                                    borderTop: `1px solid ${g.border.subtle}`,
                                },
                                ...(snapshot.isDragging && {
                                    background: g.surface.raised,
                                    border: `1px solid ${g.border.subtle}`,
                                    borderRadius: g.radius.md,
                                }),
                            }}
                        >
                            {editing === id
                                ? editForm(action)
                                : rowBody(
                                      action,
                                      index,
                                      <Box
                                          {...provided.dragHandleProps}
                                          aria-label={fmt(words.reorder, {
                                              title: titleOf(action),
                                          })}
                                          sx={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: 24,
                                              height: 32,
                                              flexShrink: 0,
                                              color: g.text.tertiary,
                                              borderRadius: g.radius.sm,
                                              cursor: "grab",
                                              "&:focus-visible": focusRing,
                                              "@media (pointer: coarse)": { height: 44 },
                                          }}
                                      >
                                          <DragIndicatorRoundedIcon
                                              aria-hidden="true"
                                              sx={{ fontSize: 16 }}
                                          />
                                      </Box>
                                  )}
                        </Box>
                    );
                    // Inside a dialog the dragged row is offset by the dialog's transform.
                    return snapshot.isDragging ? createPortal(node, document.body) : node;
                }}
            </Draggable>
        );
    };

    const atLimit = actions.length >= MAX_ACTIONS;

    const addForm = () => (
        <ActionForm
            initial={{ beforeId: null, afterId: null, title: "" }}
            projectId={projectId}
            rows={rows}
            submitLabel={t.tasks.projectStatuses.add}
            onCancel={() => closeForm("[data-add-action]")}
            onSave={async (input) => {
                const result = await enqueue(() =>
                    createProjectStatusAction(projectId, input, accessToken)
                );
                if (!result.ok) return errorText(result.code);
                closeForm("[data-add-action]");
                return null;
            }}
        />
    );

    // Before the statuses are set up there is nothing to hang an action on: the defaults are
    // shown as they work today, and the set-up is the one the statuses tab offers.
    const defaults = () => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
            <Box sx={{ ...type("body-sm"), color: g.text.secondary }}>{words.setUpHint}</Box>
            <Box aria-label={words.tab} component="ul" sx={listSx}>
                {actions.map((action) => (
                    <Box
                        key={`${action.beforeKey}-${action.afterKey}`}
                        component="li"
                        sx={{
                            px: 1.5,
                            py: 0.75,
                            "&:not(:first-of-type)": { borderTop: `1px solid ${g.border.subtle}` },
                        }}
                    >
                        <Box sx={{ ...type("body-md"), color: g.text.primary }}>
                            {titleOf(action)}
                        </Box>
                        <Box sx={type("body-xs")}>
                            <Pair action={action} rows={rows} />
                        </Box>
                    </Box>
                ))}
            </Box>
            {setUpFailed && (
                <Alert color="danger" role="alert" size="sm" variant="soft">
                    {t.tasks.projectStatuses.setUpFailed}
                </Alert>
            )}
            <Button
                loading={settingUp}
                sx={{ alignSelf: { xs: "stretch", sm: "flex-end" }, ...touchSx }}
                onClick={onSetUp}
            >
                {t.tasks.projectStatuses.setUp}
            </Button>
        </Box>
    );

    const list = () => (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pb: 2 }}>
            <Box sx={{ ...type("body-xs"), color: g.text.tertiary, px: 0.5 }}>{words.hint}</Box>
            {actions.length === 0 && editing !== "add" && (
                <EmptyState body={words.emptyBody} size="sm" title={words.emptyTitle} />
            )}
            {(actions.length > 0 || editing === "add") && (
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="quick-actions">
                        {(provided) => (
                            <Box
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                aria-label={words.tab}
                                component="ul"
                                sx={listSx}
                            >
                                {actions.map(item)}
                                {provided.placeholder}
                                {editing === "add" && (
                                    <Box
                                        component="li"
                                        sx={{ borderTop: `1px solid ${g.border.subtle}` }}
                                    >
                                        {addForm()}
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Droppable>
                </DragDropContext>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Button
                    color="neutral"
                    data-add-action=""
                    disabled={atLimit || editing === "add"}
                    size="sm"
                    startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={touchSx}
                    variant="plain"
                    onClick={() => {
                        setError(null);
                        setEditing("add");
                    }}
                >
                    {words.add}
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
                        ? fmt(words.limitHint, { max: MAX_ACTIONS })
                        : fmt(words.count, { n: actions.length, max: MAX_ACTIONS })}
                </Box>
            </Box>
        </Box>
    );

    return (
        <Box ref={body} data-testid="quick-actions">
            {!entry.loaded ? (
                <SkeletonRows count={6} label={words.tab} />
            ) : unreadable ? (
                <ErrorState
                    size="sm"
                    title={words.loadFailed}
                    onRetry={() =>
                        void refreshProjectStatusActions(projectId, accessToken, {
                            afterChange: true,
                        })
                    }
                />
            ) : !hasRows ? (
                defaults()
            ) : awaitingRows ? (
                // Set up a moment ago: the defaults' own rows are being read.
                <SkeletonRows count={6} label={words.tab} />
            ) : (
                list()
            )}
            <Box aria-live="polite" sx={srOnly}>
                {announcement}
            </Box>
            <ConfirmDialog
                cancelLabel={t.common.actions.cancel}
                confirmLabel={words.delete}
                description={words.deleteBody}
                hostZIndex={layer}
                open={deleting != null}
                title={deleting ? fmt(words.deleteTitle, { title: titleOf(deleting) }) : ""}
                destructive
                onClose={() => setDeleting(null)}
                onConfirm={async () => {
                    if (!deleting?.actionId) return;
                    const at = actions.findIndex((a) => a.actionId === deleting.actionId);
                    const neighbour = actions[at + 1] ?? actions[at - 1];
                    const result = await enqueue(() =>
                        deleteProjectStatusAction(projectId, deleting.actionId!, accessToken)
                    );
                    if (!result.ok) throw new Error(errorText(result.code));
                    setDeleting(null);
                    focusLater(
                        neighbour?.actionId
                            ? menuSelector(neighbour.actionId)
                            : "[data-add-action]"
                    );
                }}
            />
        </Box>
    );
};
