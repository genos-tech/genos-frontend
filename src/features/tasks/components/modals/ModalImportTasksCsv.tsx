import { useEffect, useRef, useState } from "react";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormLabel,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useOptionalAccessToken } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import {
    commitTaskImport,
    previewTaskImport,
    previewUndoTaskImport,
    TaskImportError,
    undoTaskImport,
    type ImportField,
    type ImportIssue,
    type ImportMapping,
    type ImportPreview,
    type ImportRun,
    type ImportValueCount,
} from "../../services/taskImportApi";

type Step = "upload" | "map" | "preview" | "result";

const STEP_ORDER: Step[] = ["upload", "map", "preview", "result"];
const MAX_MB = 5;
const NOT_USED = "-1";
// A priority the person set to "none": the server reads it as "leave this value without one".
const NO_PRIORITY = "none";

const FIELDS: ImportField[] = [
    "title",
    "description",
    "status",
    "priority",
    "assignee",
    "due_date",
    "start_date",
    "tags",
    "parent",
    "external_id",
];
const STATUSES = ["Open", "WIP", "Blocked", "Pending", "Closed"] as const;
const PRIORITIES = ["Minimal", "Low", "Normal", "High", "Critical"] as const;

interface Props {
    open: boolean;
    onClose: () => void;
    projectId: number;
    /** Called after tasks were created or removed, so the task list can reload. */
    onChanged?: () => void;
    hostZIndex?: number;
}

/**
 * "Import tasks from CSV…" (MIP-1835): file, columns, preview, result.
 *
 * The server reads the file (a stateless preview), so the file is sent again at the import; the
 * dialog keeps it in memory only. A Jira or Notion export is detected from its headers and the
 * columns come back filled in; the person can change every one of them. Nothing is created until
 * the preview step's Import button.
 */
export const ModalImportTasksCsv = ({
    open,
    onClose,
    projectId,
    onChanged,
    hostZIndex,
}: Props) => {
    const { t } = useTranslation();
    const c = t.tasks.importCsv;
    const accessToken = useOptionalAccessToken();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [mapping, setMapping] = useState<ImportMapping>({});
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});
    const [priorityMap, setPriorityMap] = useState<Record<string, string>>({});
    const [createTags, setCreateTags] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [run, setRun] = useState<ImportRun | null>(null);
    const [undoPlan, setUndoPlan] = useState<{ will_remove: number; kept: number } | null>(null);
    const [undone, setUndone] = useState<{ removed: number; kept: number } | null>(null);

    // A fresh dialog every time it opens.
    useEffect(() => {
        if (!open) return;
        setStep("upload");
        setFile(null);
        setPreview(null);
        setMapping({});
        setStatusMap({});
        setPriorityMap({});
        setCreateTags(true);
        setBusy(false);
        setError(null);
        setRun(null);
        setUndoPlan(null);
        setUndone(null);
    }, [open]);

    const errorText = (e: unknown): string => {
        const code = e instanceof TaskImportError ? e.code : "generic";
        const limit = e instanceof TaskImportError ? (e.limit ?? "") : "";
        switch (code) {
            case "file_too_large":
                return fmt(c.errFileTooLarge, { limit: limit || MAX_MB });
            case "too_many_rows":
                return fmt(c.errTooManyRows, { limit: limit || preview?.limits.max_rows || 1000 });
            case "empty_file":
            case "file_missing":
                return c.errEmptyFile;
            case "bad_encoding":
                return c.errBadEncoding;
            case "bad_csv":
                return c.errBadCsv;
            case "archived":
                return c.errArchived;
            case "forbidden":
            case "project_not_found":
                return c.errForbidden;
            case "quota":
                return c.errQuota;
            default:
                return c.errGeneric;
        }
    };

    const onPickFile = async (picked: File | null) => {
        if (!picked) return;
        setBusy(true);
        setError(null);
        try {
            const p = await previewTaskImport(accessToken ?? null, { projectId, file: picked });
            setFile(picked);
            setPreview(p);
            setMapping(p.mapping);
            setStatusMap({});
            setPriorityMap({});
            setStep("map");
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const toPreview = async () => {
        if (!file) return;
        if (!mapping.title?.length) {
            setError(c.titleRequired);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const p = await previewTaskImport(accessToken ?? null, {
                projectId,
                file,
                mapping,
                statusMap,
                priorityMap,
            });
            setPreview(p);
            setStep("preview");
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    const doImport = async () => {
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            const result = await commitTaskImport(accessToken ?? null, {
                projectId,
                file,
                mapping,
                statusMap,
                priorityMap,
                createTags,
            });
            setRun(result);
            setStep("result");
            onChanged?.();
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    const askUndo = async () => {
        if (!run) return;
        setBusy(true);
        setError(null);
        try {
            setUndoPlan(await previewUndoTaskImport(accessToken ?? null, run.run_id));
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    const doUndo = async () => {
        if (!run) return;
        setBusy(true);
        setError(null);
        try {
            setUndone(await undoTaskImport(accessToken ?? null, run.run_id));
            setUndoPlan(null);
            onChanged?.();
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    const fieldLabel: Record<ImportField, string> = {
        title: c.fieldTitle,
        description: c.fieldDescription,
        status: c.fieldStatus,
        priority: c.fieldPriority,
        assignee: c.fieldAssignee,
        due_date: c.fieldDueDate,
        start_date: c.fieldStartDate,
        tags: c.fieldTags,
        parent: c.fieldParent,
        external_id: c.fieldExternalId,
    };
    const statusLabel: Record<string, string> = {
        Open: c.statusOpen,
        WIP: c.statusWip,
        Blocked: c.statusBlocked,
        Pending: c.statusPending,
        Closed: c.statusClosed,
    };
    const priorityLabel: Record<string, string> = {
        Minimal: c.priorityMinimal,
        Low: c.priorityLow,
        Normal: c.priorityNormal,
        High: c.priorityHigh,
        Critical: c.priorityCritical,
    };

    const issueText = (issue: ImportIssue): string => {
        const v = { value: issue.value ?? "" };
        switch (issue.code) {
            case "title_missing":
                return c.issueTitleMissing;
            case "duplicate_in_file":
                return c.issueDuplicateInFile;
            case "create_failed":
                return c.issueCreateFailed;
            case "status_unknown":
                return fmt(c.warnStatusUnknown, v);
            case "priority_unknown":
                return fmt(c.warnPriorityUnknown, v);
            case "date_ambiguous":
                return fmt(c.warnDateAmbiguous, v);
            case "date_unparsable":
                return fmt(c.warnDateUnparsable, v);
            case "assignee_not_email":
                return fmt(c.warnAssigneeNotEmail, v);
            case "assignee_unknown":
                return fmt(c.warnAssigneeUnknown, v);
            case "parent_missing":
                return fmt(c.warnParentMissing, v);
            case "parent_cycle":
                return fmt(c.warnParentCycle, v);
            case "title_truncated":
                return c.warnTitleTruncated;
            case "description_truncated":
                return c.warnDescriptionTruncated;
            default:
                return issue.code;
        }
    };

    const stepLabel: Record<Step, string> = {
        upload: c.stepUpload,
        map: c.stepMap,
        preview: c.stepPreview,
        result: c.stepResult,
    };

    const detected =
        preview?.profile === "jira"
            ? c.detectedJira
            : preview?.profile === "notion"
              ? c.detectedNotion
              : c.detectedGeneric;

    const columnSelect = (field: ImportField) => {
        const current = mapping[field]?.[0];
        return (
            <FormControl key={field} size="sm">
                <FormLabel>{fieldLabel[field]}</FormLabel>
                <Select
                    slotProps={{ button: { "aria-label": fieldLabel[field] } }}
                    value={current === undefined ? NOT_USED : String(current)}
                    onChange={(_, v) => {
                        const next = { ...mapping };
                        if (v === null || v === NOT_USED) delete next[field];
                        else {
                            // Jira repeats Labels and carries two ids: changing the first column
                            // keeps the others, so no tag or parent link is lost by a touch.
                            const picked = Number(v);
                            const rest = (mapping[field] ?? [])
                                .slice(1)
                                .filter((x) => x !== picked);
                            next[field] = [picked, ...rest];
                        }
                        setMapping(next);
                    }}
                >
                    <Option value={NOT_USED}>{c.notUsed}</Option>
                    {(preview?.headers ?? []).map((h, i) => (
                        <Option key={i} value={String(i)}>
                            {h || `#${i + 1}`}
                        </Option>
                    ))}
                </Select>
            </FormControl>
        );
    };

    const valueTable = (
        heading: string,
        values: ImportValueCount[],
        map: Record<string, string>,
        setMap: (m: Record<string, string>) => void,
        options: readonly string[],
        labels: Record<string, string>,
        allowNone: boolean
    ) =>
        values.length === 0 ? null : (
            <Box>
                <Typography level="title-sm" sx={{ mb: 0.5 }}>
                    {heading}
                </Typography>
                <Stack gap={0.75}>
                    {values.map((v) => (
                        <Stack key={v.value} alignItems="center" direction="row" gap={1}>
                            <Typography
                                level="body-sm"
                                sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
                            >
                                {v.value}
                                <Typography
                                    level="body-xs"
                                    sx={{ marginInlineStart: 0.75, color: g.text.tertiary }}
                                >
                                    {" "}
                                    ×{v.count}
                                </Typography>
                            </Typography>
                            <Select
                                size="sm"
                                slotProps={{ button: { "aria-label": v.value } }}
                                sx={{ width: 150, flexShrink: 0 }}
                                value={
                                    map[v.value] ?? v.mapped ?? (allowNone ? NO_PRIORITY : "Open")
                                }
                                onChange={(_, val) =>
                                    setMap({ ...map, [v.value]: val ?? NO_PRIORITY })
                                }
                            >
                                {allowNone && <Option value={NO_PRIORITY}>{c.noPriority}</Option>}
                                {options.map((o) => (
                                    <Option key={o} value={o}>
                                        {labels[o]}
                                    </Option>
                                ))}
                            </Select>
                        </Stack>
                    ))}
                </Stack>
            </Box>
        );

    const counts = preview?.counts;
    const shown = preview?.rows.length ?? 0;
    const canImport = !busy && (counts?.to_create ?? 0) > 0;

    const actions =
        step === "upload" ? (
            <Button color="neutral" variant="plain" onClick={onClose}>
                {c.close}
            </Button>
        ) : step === "map" ? (
            <>
                <Button
                    color="neutral"
                    disabled={busy}
                    variant="plain"
                    onClick={() => {
                        setError(null);
                        setStep("upload");
                    }}
                >
                    {c.back}
                </Button>
                <Button loading={busy} onClick={toPreview}>
                    {c.next}
                </Button>
            </>
        ) : step === "preview" ? (
            <>
                <Button
                    color="neutral"
                    disabled={busy}
                    variant="plain"
                    onClick={() => {
                        setError(null);
                        setStep("map");
                    }}
                >
                    {c.back}
                </Button>
                <Button disabled={!canImport} loading={busy} onClick={doImport}>
                    {busy ? c.importing : fmt(c.import, { count: counts?.to_create ?? 0 })}
                </Button>
            </>
        ) : (
            <Button onClick={onClose}>{c.close}</Button>
        );

    return (
        <ModalFrame
            actions={actions}
            description={c.description}
            dismissible={!busy}
            hostZIndex={hostZIndex}
            icon={<UploadFileRoundedIcon />}
            open={open}
            size="lg"
            title={c.title}
            fullScreenOnMobile
            onClose={onClose}
        >
            <Stack data-testid="import-tasks-csv" gap={2} sx={{ minWidth: 0 }}>
                <Stack
                    aria-label={stepLabel[step]}
                    data-testid="import-steps"
                    direction="row"
                    flexWrap="wrap"
                    gap={1}
                >
                    {STEP_ORDER.map((s) => (
                        <Chip
                            key={s}
                            aria-current={s === step ? "step" : undefined}
                            color={s === step ? "primary" : "neutral"}
                            size="sm"
                            variant={s === step ? "solid" : "outlined"}
                        >
                            {stepLabel[s]}
                        </Chip>
                    ))}
                </Stack>

                {error && (
                    <Typography level="body-sm" role="alert" sx={{ color: g.danger.text }}>
                        {error}
                    </Typography>
                )}

                {step === "upload" && (
                    <Stack alignItems="flex-start" gap={1.5}>
                        <input
                            ref={fileInputRef}
                            accept=".csv,text/csv"
                            data-testid="import-tasks-file"
                            type="file"
                            hidden
                            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
                        />
                        <Button
                            loading={busy}
                            startDecorator={<UploadFileRoundedIcon />}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {busy ? c.reading : c.chooseFile}
                        </Button>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {fmt(c.fileHint, {
                                rows: preview?.limits.max_rows ?? 1000,
                                mb: MAX_MB,
                            })}
                        </Typography>
                    </Stack>
                )}

                {step === "map" && preview && (
                    <Stack gap={2}>
                        <Stack alignItems="center" direction="row" flexWrap="wrap" gap={1}>
                            <Chip color="success" size="sm" variant="soft">
                                {detected}
                            </Chip>
                            <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                {file?.name} · {fmt(c.rowsInFile, { count: preview.counts.rows })}
                            </Typography>
                        </Stack>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {c.mapIntro}
                        </Typography>
                        <Box
                            sx={{
                                display: "grid",
                                gap: 1.5,
                                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            }}
                        >
                            {FIELDS.map(columnSelect)}
                        </Box>
                        {(preview.status_values.length > 0 ||
                            preview.priority_values.length > 0) && (
                            <Stack gap={1.5}>
                                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                    {c.valuesIntro}
                                </Typography>
                                {valueTable(
                                    c.statusValues,
                                    preview.status_values,
                                    statusMap,
                                    setStatusMap,
                                    STATUSES,
                                    statusLabel,
                                    false
                                )}
                                {valueTable(
                                    c.priorityValues,
                                    preview.priority_values,
                                    priorityMap,
                                    setPriorityMap,
                                    PRIORITIES,
                                    priorityLabel,
                                    true
                                )}
                            </Stack>
                        )}
                    </Stack>
                )}

                {step === "preview" && preview && counts && (
                    <Stack gap={1.5}>
                        <Typography data-testid="import-summary" level="title-sm">
                            {fmt(c.summary, {
                                create: counts.to_create,
                                skipped: counts.already_imported,
                                errors: counts.errors,
                            })}
                        </Typography>
                        {preview.new_tags.length > 0 && (
                            <Stack gap={0.5}>
                                <Typography level="body-sm">
                                    {fmt(c.newTags, { tags: preview.new_tags.join(", ") })}
                                </Typography>
                                <Checkbox
                                    checked={createTags}
                                    label={c.createTags}
                                    size="sm"
                                    onChange={(e) => setCreateTags(e.target.checked)}
                                />
                            </Stack>
                        )}
                        {counts.to_create === 0 && (
                            <Typography level="body-sm">{c.zeroToCreate}</Typography>
                        )}
                        <Box
                            sx={{
                                maxWidth: "100%",
                                minWidth: 0,
                                overflowX: "auto",
                                border: 1,
                                borderColor: g.border.subtle,
                            }}
                        >
                            <Box
                                component="table"
                                sx={{
                                    width: "100%",
                                    minWidth: 520,
                                    borderCollapse: "collapse",
                                    fontSize: 13,
                                    "& th, & td": {
                                        textAlign: "start",
                                        padding: "6px 8px",
                                        borderBottom: "1px solid",
                                        borderColor: g.border.subtle,
                                        verticalAlign: "top",
                                    },
                                    "& th": { fontWeight: 500, color: g.text.secondary },
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th>{c.colRow}</th>
                                        <th>{c.colTitle}</th>
                                        <th>{c.colStatus}</th>
                                        <th>{c.colAssignee}</th>
                                        <th>{c.colDue}</th>
                                        <th>{c.colNotes}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.rows.map((r) => (
                                        <tr key={r.row} data-testid={`import-row-${r.row}`}>
                                            <td>{r.row}</td>
                                            <td style={{ overflowWrap: "anywhere" }}>{r.title}</td>
                                            <td>{statusLabel[r.status] ?? r.status}</td>
                                            <td style={{ overflowWrap: "anywhere" }}>
                                                {r.assignee_email}
                                            </td>
                                            <td>{r.due_date ?? ""}</td>
                                            <td>
                                                {r.errors.map((i) => (
                                                    <Typography
                                                        key={i.code}
                                                        level="body-xs"
                                                        sx={{ color: g.danger.text }}
                                                    >
                                                        {issueText(i)}
                                                    </Typography>
                                                ))}
                                                {!r.errors.length && r.already_imported && (
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{ color: g.text.tertiary }}
                                                    >
                                                        {c.alreadyImported}
                                                    </Typography>
                                                )}
                                                {r.warnings.map((i, n) => (
                                                    <Typography
                                                        key={`${i.code}${n}`}
                                                        level="body-xs"
                                                        sx={{ color: g.warning.text }}
                                                    >
                                                        {issueText(i)}
                                                    </Typography>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Box>
                        </Box>
                        {shown < counts.rows && (
                            <Typography level="body-xs" sx={{ color: g.text.tertiary }}>
                                {fmt(c.showing, { shown, total: counts.rows })}
                            </Typography>
                        )}
                    </Stack>
                )}

                {step === "result" && run && (
                    <Stack gap={1.5}>
                        <Typography data-testid="import-result" level="title-sm">
                            {fmt(c.resultSummary, {
                                created: run.created,
                                skipped: run.skipped,
                                failed: run.failed,
                            })}
                        </Typography>
                        {run.report.some((r) => r.outcome === "failed") && (
                            <Stack gap={0.5}>
                                <Typography level="title-sm">{c.failedHeading}</Typography>
                                {run.report
                                    .filter((r) => r.outcome === "failed")
                                    .map((r) => (
                                        <Typography
                                            key={r.row}
                                            level="body-sm"
                                            sx={{ color: g.danger.text }}
                                        >
                                            {fmt(c.rowFailed, {
                                                row: r.row,
                                                reason: issueText({ code: r.code ?? "" }),
                                            })}
                                        </Typography>
                                    ))}
                            </Stack>
                        )}
                        {run.created > 0 && !undone && (
                            <Stack alignItems="flex-start" gap={1}>
                                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                    {c.undoHint}
                                </Typography>
                                {undoPlan ? (
                                    <>
                                        <Typography level="body-sm">
                                            {fmt(c.undoConfirm, {
                                                count: undoPlan.will_remove,
                                                kept: undoPlan.kept,
                                            })}
                                        </Typography>
                                        <Button
                                            color="danger"
                                            loading={busy}
                                            variant="soft"
                                            onClick={doUndo}
                                        >
                                            {busy
                                                ? c.undoing
                                                : fmt(c.undoConfirmButton, {
                                                      count: undoPlan.will_remove,
                                                  })}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        color="neutral"
                                        loading={busy}
                                        variant="outlined"
                                        onClick={askUndo}
                                    >
                                        {c.undo}
                                    </Button>
                                )}
                            </Stack>
                        )}
                        {undone && (
                            <Typography data-testid="import-undone" level="body-sm">
                                {fmt(c.undone, { removed: undone.removed, kept: undone.kept })}
                            </Typography>
                        )}
                    </Stack>
                )}
            </Stack>
        </ModalFrame>
    );
};
