import { useEffect, useRef, useState } from "react";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { Alert, Box, Button, Checkbox, Chip, Stack, Typography } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useOptionalAccessToken } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { g } from "../../../../theme/tokens";
import {
    commitSlackImport,
    previewSlackImport,
    previewUndoSlackImport,
    SlackImportError,
    undoSlackImport,
    type SlackPreview,
    type SlackRun,
    type SlackUndoPlan,
} from "../../services/slackImportApi";

type Step = "upload" | "preview" | "result";

interface Props {
    open: boolean;
    onClose: () => void;
    teamId: string;
    hostZIndex?: number;
}

/**
 * "Import from Slack…" (MIP-1836): upload the export ZIP, review what will happen, import, undo.
 * Owner only (the server says 403 to anyone else). The ZIP is read by the server; the dialog keeps
 * the file in memory so it can be sent again at the import. Nothing is created before the Import
 * button of the preview step.
 */
export const ModalImportSlack = ({ open, onClose, teamId, hostZIndex }: Props) => {
    const { t } = useTranslation();
    const c = t.admin.slackImport;
    const accessToken = useOptionalAccessToken();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<SlackPreview | null>(null);
    const [chosen, setChosen] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [run, setRun] = useState<SlackRun | null>(null);
    const [undoPlan, setUndoPlan] = useState<SlackUndoPlan | null>(null);
    const [undone, setUndone] = useState<{ removed_messages: number; kept: number } | null>(null);

    useEffect(() => {
        if (!open) return;
        setStep("upload");
        setFile(null);
        setPreview(null);
        setChosen(new Set());
        setBusy(false);
        setError(null);
        setRun(null);
        setUndoPlan(null);
        setUndone(null);
    }, [open]);

    const errorText = (e: unknown): string => {
        const code = e instanceof SlackImportError ? e.code : "generic";
        const limit = e instanceof SlackImportError ? (e.limit ?? "") : "";
        switch (code) {
            case "file_too_large":
            case "export_too_large":
                return fmt(c.errFileTooLarge, {
                    limit: limit || preview?.limits.max_zip_mb || 50,
                });
            case "not_a_zip":
            case "not_a_slack_export":
            case "bad_json":
            case "file_missing":
                return c.errNotExport;
            case "zip_unsafe":
                return c.errUnsafe;
            case "too_many_channels":
            case "too_many_messages":
            case "too_many_users":
                return fmt(c.errTooMany, { limit });
            case "nothing_to_import":
                return c.errNothing;
            case "import_in_progress":
                return c.errBusy;
            case "forbidden":
            case "team_not_found":
                return c.errForbidden;
            default:
                return c.errGeneric;
        }
    };

    const onPick = async (picked: File | null) => {
        if (!picked) return;
        setBusy(true);
        setError(null);
        try {
            const p = await previewSlackImport(accessToken ?? null, teamId, picked);
            setFile(picked);
            setPreview(p);
            setChosen(
                new Set(
                    p.channels.filter((ch) => ch.target.action !== "skip").map((ch) => ch.slack_id)
                )
            );
            setStep("preview");
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const doImport = async () => {
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            setRun(await commitSlackImport(accessToken ?? null, teamId, file, [...chosen]));
            setStep("result");
            void channelService.refreshChannels();
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
            setUndoPlan(await previewUndoSlackImport(accessToken ?? null, teamId, run.run_id));
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
            setUndone(await undoSlackImport(accessToken ?? null, teamId, run.run_id));
            setUndoPlan(null);
            void channelService.refreshChannels();
        } catch (e) {
            setError(errorText(e));
        } finally {
            setBusy(false);
        }
    };

    const warningText = (code: string, count?: number): string => {
        const v = { count: count ?? 0 };
        switch (code) {
            case "file_links_need_slack_login":
                return c.warnFiles;
            case "unmatched_authors":
                return fmt(c.warnUnmatched, v);
            case "orphan_replies":
                return fmt(c.warnOrphans, v);
            case "dms_skipped":
                return c.warnDms;
            default:
                return code;
        }
    };

    const toImport = preview
        ? preview.channels
              .filter((ch) => chosen.has(ch.slack_id) && ch.target.action !== "skip")
              .reduce((n, ch) => n + (ch.message_count - ch.already_imported), 0)
        : 0;

    const actions =
        step === "upload" ? (
            <Button color="neutral" variant="plain" onClick={onClose}>
                {c.close}
            </Button>
        ) : step === "preview" ? (
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
                <Button
                    data-testid="slack-import-go"
                    disabled={busy || chosen.size === 0 || toImport === 0}
                    loading={busy}
                    onClick={doImport}
                >
                    {busy ? c.importing : fmt(c.import, { count: toImport })}
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
            <Stack data-testid="import-slack" gap={2} sx={{ minWidth: 0 }}>
                {error && (
                    <Alert color="danger" role="alert" variant="soft">
                        {error}
                    </Alert>
                )}

                {step === "upload" && (
                    <Stack alignItems="flex-start" gap={1.5}>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {c.howTo}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {fmt(c.limits, { mb: 50, channels: 50, messages: 20000 })}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                            {c.filesNote}
                        </Typography>
                        <input
                            ref={fileInputRef}
                            accept=".zip,application/zip"
                            aria-label={c.chooseFile}
                            data-testid="slack-import-file"
                            type="file"
                            hidden
                            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
                        />
                        <Button
                            loading={busy}
                            startDecorator={<UploadFileRoundedIcon />}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {c.chooseFile}
                        </Button>
                    </Stack>
                )}

                {step === "preview" && preview && (
                    <Stack gap={1.5}>
                        <Typography data-testid="slack-import-summary" level="title-sm">
                            {fmt(c.summary, {
                                channels: preview.counts.channels,
                                messages: preview.counts.messages,
                                threads: preview.counts.threads,
                                skipped: preview.counts.already_imported,
                            })}
                        </Typography>
                        {preview.warnings.map((w) => (
                            <Alert key={w.code} color="warning" size="sm" variant="soft">
                                {warningText(w.code, w.count)}
                            </Alert>
                        ))}
                        <Typography level="title-sm">{c.channelsHeading}</Typography>
                        <Stack gap={0.75}>
                            {preview.channels.map((ch) => (
                                <Box
                                    key={ch.slack_id}
                                    sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                                >
                                    <Checkbox
                                        checked={chosen.has(ch.slack_id)}
                                        disabled={ch.target.action === "skip"}
                                        slotProps={{ input: { "aria-label": ch.name } }}
                                        onChange={(e) => {
                                            const next = new Set(chosen);
                                            if (e.target.checked) next.add(ch.slack_id);
                                            else next.delete(ch.slack_id);
                                            setChosen(next);
                                        }}
                                    />
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            level="body-sm"
                                            sx={{ overflowWrap: "anywhere" }}
                                        >
                                            #{ch.name}{" "}
                                            {ch.is_private && <Chip size="sm">{c.private}</Chip>}{" "}
                                            {ch.is_archived && <Chip size="sm">{c.archived}</Chip>}
                                        </Typography>
                                        <Typography
                                            level="body-xs"
                                            sx={{ color: g.text.secondary }}
                                        >
                                            {fmt(c.channelLine, {
                                                messages: ch.message_count,
                                                title: ch.target.title,
                                            })}
                                            {ch.target.action === "existing" && ` · ${c.existing}`}
                                            {ch.target.action === "skip" &&
                                                ` · ${c.targetArchived}`}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                        <Typography level="title-sm">{c.peopleHeading}</Typography>
                        <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                            {c.peopleHint}
                        </Typography>
                        <Box
                            sx={{
                                maxWidth: "100%",
                                overflowX: "auto",
                                border: 1,
                                borderColor: g.border.subtle,
                            }}
                        >
                            <Box
                                component="table"
                                sx={{
                                    width: "100%",
                                    minWidth: 420,
                                    borderCollapse: "collapse",
                                    fontSize: 13,
                                    "& th, & td": {
                                        textAlign: "start",
                                        padding: "6px 8px",
                                        borderBottom: "1px solid",
                                        borderColor: g.border.subtle,
                                    },
                                    "& th": { fontWeight: 500, color: g.text.secondary },
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th>{c.colName}</th>
                                        <th>{c.colMatch}</th>
                                        <th>{c.colMessages}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.users.map((u) => (
                                        <tr key={u.slack_id}>
                                            <td style={{ overflowWrap: "anywhere" }}>{u.name}</td>
                                            <td>
                                                {u.status === "matched" && u.genos_user
                                                    ? fmt(c.matchedTo, {
                                                          name: u.genos_user.username,
                                                      })
                                                    : c.status[u.status]}
                                            </td>
                                            <td>{u.message_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Box>
                        </Box>
                    </Stack>
                )}

                {step === "result" && run && (
                    <Stack gap={1.5}>
                        <Typography data-testid="slack-import-result" level="title-sm">
                            {fmt(c.resultSummary, {
                                channels: run.channels_created,
                                messages: run.messages_created,
                                failed: run.failed,
                            })}
                        </Typography>
                        {run.messages_created > 0 && !undone && (
                            <Stack alignItems="flex-start" gap={1}>
                                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                                    {c.undoHint}
                                </Typography>
                                {undoPlan ? (
                                    <>
                                        <Typography level="body-sm">
                                            {fmt(c.undoConfirm, {
                                                messages: undoPlan.will_remove_messages,
                                                channels: undoPlan.will_delete_channels,
                                                kept: undoPlan.kept,
                                            })}
                                        </Typography>
                                        <Button
                                            color="danger"
                                            loading={busy}
                                            variant="soft"
                                            onClick={doUndo}
                                        >
                                            {c.undoConfirmButton}
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
                            <Typography data-testid="slack-import-undone" level="body-sm">
                                {fmt(c.undone, {
                                    removed: undone.removed_messages,
                                    kept: undone.kept,
                                })}
                            </Typography>
                        )}
                    </Stack>
                )}
            </Stack>
        </ModalFrame>
    );
};
