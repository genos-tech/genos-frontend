/**
 * "Sample data" in the team profile (MIP-1706): one action that removes everything the
 * sample-data box made when the team was created. The team owner's alone; the server refuses
 * anyone else, and the host renders this only for the owner.
 *
 * Opening the dialog reads a PREVIEW, so what it lists is exactly what the removal then does:
 * the projects, group chats, team folders, notes, to-dos, tag and mention group that go, and
 * what stays and why (something the person added to or edited in a sample item is never taken).
 * After the removal the app reloads, because the removed things live in several local caches
 * (projects, tasks, notes, chats, to-dos) and an open pane must not keep showing a removed one;
 * the chat list is refreshed first, with `refreshChannels` (which evicts), not `listChannels`.
 */
import { useCallback, useEffect, useState } from "react";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import { Alert, Box, Button, FormControl, FormLabel, Typography } from "@mui/joy";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../context/authState";
import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { g } from "../../../../theme/tokens";
import {
    loadSampleDataPreview,
    removeSampleData,
    type SampleDataEntry,
    type SampleDataPreview,
    type SampleDataResult,
    type SampleDataType,
} from "../../services/sampleData";

type Props = {
    /** The team's owner, and only them. The panel renders nothing for anyone else. */
    isOwner: boolean;
    teamId: string;
    /** The host modal's z-index, so the dialogs stack above it. */
    zIndex: number;
};

/** The order the dialog lists them in: what people notice first. */
const TYPE_ORDER: SampleDataType[] = [
    "project",
    "channel",
    "note_folder",
    "note",
    "todo_item",
    "todo_category",
    "mention_group",
    "project_label",
];

const groupByType = (entries: SampleDataEntry[]) =>
    TYPE_ORDER.map((type) => ({ type, items: entries.filter((e) => e.type === type) })).filter(
        (group) => group.items.length > 0
    );

type Phase =
    | { kind: "closed" }
    | { kind: "loading" }
    | { kind: "failed"; message: string }
    | { kind: "ready"; preview: SampleDataPreview }
    | { kind: "done"; result: SampleDataResult };

export const SampleDataPanel = ({ isOwner, teamId, zIndex }: Props) => {
    const { t } = useTranslation();
    const s = t.admin.sampleData;
    const { accessToken } = useAuth();
    const [phase, setPhase] = useState<Phase>({ kind: "closed" });
    // Bumped to ask for the preview again (the Try again button).
    const [attempt, setAttempt] = useState(0);

    const open = phase.kind !== "closed" && phase.kind !== "done";

    useEffect(() => {
        if (phase.kind !== "loading") return;
        let live = true;
        loadSampleDataPreview(accessToken, teamId).then(
            (preview) => {
                if (live) setPhase({ kind: "ready", preview });
            },
            (error: unknown) => {
                if (live)
                    setPhase({
                        kind: "failed",
                        message: error instanceof Error ? error.message : s.loadFailed,
                    });
            }
        );
        return () => {
            live = false;
        };
        // `attempt` re-runs the load when Try again is pressed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase.kind, attempt, accessToken, teamId]);

    const close = useCallback(() => setPhase({ kind: "closed" }), []);

    const confirm = async () => {
        const result = await removeSampleData(accessToken, teamId);
        // The sidebar's chat list, now: `refreshChannels` evicts the chats the server dropped.
        void channelService.refreshChannels();
        setPhase({ kind: "done", result });
    };

    // Everything local is re-read from the server by loading the workspace again.
    const reload = () => window.location.assign("/workspace");

    const preview = phase.kind === "ready" ? phase.preview : null;
    const canConfirm = preview != null && preview.remove.length > 0;

    const entryLine = (entry: SampleDataEntry, withReason: boolean) => (
        <Box key={`${entry.type}:${entry.id}`} component="li" sx={{ overflowWrap: "anywhere" }}>
            {entry.name}
            {withReason && entry.reason && (
                <Typography component="span" level="body-xs" sx={{ color: g.text.secondary }}>
                    {" — "}
                    {s.keepReason[entry.reason as keyof typeof s.keepReason] ?? ""}
                </Typography>
            )}
        </Box>
    );

    const list = (entries: SampleDataEntry[], withReason: boolean) =>
        groupByType(entries).map((group) => (
            <Box key={group.type} sx={{ mb: 1 }}>
                <Typography level="title-sm" sx={{ color: g.text.primary }}>
                    {fmt(s.type[group.type], { count: group.items.length })}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, color: g.text.secondary }}>
                    {group.items.map((entry) => entryLine(entry, withReason))}
                </Box>
            </Box>
        ));

    const body = () => {
        if (phase.kind === "loading") {
            return (
                <Typography level="body-sm" sx={{ color: g.text.secondary }}>
                    {s.loading}
                </Typography>
            );
        }
        if (phase.kind === "failed") {
            return (
                <Alert color="danger" variant="soft">
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        <span>{phase.message}</span>
                        <Button
                            color="neutral"
                            size="sm"
                            variant="outlined"
                            onClick={() => {
                                setPhase({ kind: "loading" });
                                setAttempt((n) => n + 1);
                            }}
                        >
                            {s.retry}
                        </Button>
                    </Box>
                </Alert>
            );
        }
        if (!preview) return null;
        if (!preview.recorded) {
            return (
                <EmptyState body={s.notRecorded} data-empty="sample-data-not-recorded" size="sm" />
            );
        }
        return (
            <Box sx={{ maxHeight: "45vh", overflowY: "auto", pr: 0.5 }}>
                {preview.remove.length === 0 ? (
                    <EmptyState
                        body={s.nothingToRemove}
                        data-empty="sample-data-nothing-to-remove"
                        size="sm"
                    />
                ) : (
                    <>
                        <Typography level="title-md" sx={{ mb: 0.5 }}>
                            {s.removeHeading}
                        </Typography>
                        {list(preview.remove, false)}
                        {(preview.contents.tasks != null ||
                            preview.contents.milestones != null) && (
                            <Typography level="body-xs" sx={{ color: g.text.secondary, mb: 1 }}>
                                {fmt(s.projectContents, {
                                    tasks: preview.contents.tasks ?? 0,
                                    milestones: preview.contents.milestones ?? 0,
                                })}
                            </Typography>
                        )}
                    </>
                )}
                {preview.keep.length > 0 && (
                    <>
                        <Typography level="title-md" sx={{ mt: 1, mb: 0.5 }}>
                            {s.keepHeading}
                        </Typography>
                        {list(preview.keep, true)}
                    </>
                )}
            </Box>
        );
    };

    const result = phase.kind === "done" ? phase.result : null;

    if (!isOwner) return null;

    return (
        <>
            <FormControl sx={{ mt: 1 }}>
                <FormLabel
                    sx={{
                        color: g.text.secondary,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        mb: 0.5,
                    }}
                >
                    {s.title}
                </FormLabel>
                <Typography level="body-sm" sx={{ color: g.text.secondary, mb: 1 }}>
                    {s.description}
                </Typography>
                <Box>
                    <Button
                        color="danger"
                        data-testid="sample-data-open"
                        size="sm"
                        startDecorator={<DeleteSweepRoundedIcon fontSize="small" />}
                        variant="outlined"
                        sx={{
                            borderRadius: g.radius.sm,
                            borderColor: g.danger.border,
                            color: g.danger.text,
                            "&:hover": {
                                background: g.danger.subtle,
                                borderColor: g.danger.border,
                            },
                        }}
                        onClick={() => setPhase({ kind: "loading" })}
                    >
                        {s.button}
                    </Button>
                </Box>
            </FormControl>
            <ConfirmDialog
                cancelLabel={s.cancel}
                confirmDisabled={!canConfirm}
                confirmLabel={s.confirm}
                description={s.dialogBody}
                hostZIndex={zIndex}
                open={open}
                title={s.dialogTitle}
                destructive
                onClose={close}
                onConfirm={confirm}
            >
                {body()}
            </ConfirmDialog>
            <ConfirmDialog
                cancelLabel={s.close}
                confirmLabel={s.reload}
                hostZIndex={zIndex}
                open={result != null}
                title={s.resultTitle}
                onClose={reload}
                onConfirm={reload}
            >
                {result && (
                    <Box sx={{ color: g.text.secondary }}>
                        <Typography level="body-sm">
                            {result.removed.length > 0
                                ? fmt(s.resultRemoved, { count: result.removed.length })
                                : s.resultNothing}
                        </Typography>
                        {result.kept.length > 0 && (
                            <Typography level="body-sm">
                                {fmt(s.resultKept, { count: result.kept.length })}
                            </Typography>
                        )}
                        {result.failed.length > 0 && (
                            <Alert color="danger" sx={{ mt: 1 }} variant="soft">
                                {fmt(s.resultFailed, {
                                    count: result.failed.length,
                                    names: result.failed.map((e) => e.name).join(", "),
                                })}
                            </Alert>
                        )}
                    </Box>
                )}
            </ConfirmDialog>
        </>
    );
};
