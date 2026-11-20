import { useCallback, useEffect, useState } from "react";
import RestoreFromTrashRoundedIcon from "@mui/icons-material/RestoreFromTrashRounded";
import { Alert, Box, Button, Typography } from "@mui/joy";

import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { fmt, useTranslation } from "../../../../i18n";
import {
    channelService,
    ChannelServiceError,
    type DeletedChannel,
} from "../../../../services/channel/channelService";
import { g } from "../../../../theme/tokens";

type Props = {
    open: boolean;
    teamId: string;
    onClose: () => void;
};

const formatDeleted = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ""
        : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

/**
 * "Recently deleted" groups (MIP-1715): the groups the caller owns and deleted with the default
 * (soft) choice, each with a Restore action. Restoring asks first, because the dialog is also
 * where the one thing a restore cannot bring back is said: the access the group's membership had
 * given on notes written in it. Everything else (messages, members, files) returns as it was.
 *
 * Only the owner's own groups are listed (the server decides), and there is no expiry: a group
 * deleted softly stays here until it is restored or erased by a hard delete elsewhere.
 */
export const ModalRecentlyDeletedChats = ({ open, teamId, onClose }: Props) => {
    const { t } = useTranslation();
    const copy = t.common.recentlyDeleted;
    const [rows, setRows] = useState<DeletedChannel[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [pick, setPick] = useState<DeletedChannel | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setRows(null);
        setLoadFailed(false);
        try {
            setRows(await channelService.listDeletedChannels(teamId));
        } catch (error) {
            console.error("[ModalRecentlyDeletedChats] list failed:", error);
            setLoadFailed(true);
        }
    }, [teamId]);

    // Every opening reads the list again: a group deleted a minute ago must be in it.
    useEffect(() => {
        if (!open) return;
        setPick(null);
        setNotice(null);
        void load();
    }, [open, load]);

    const drop = (id: string) => setRows((cur) => (cur ? cur.filter((r) => r.id !== id) : cur));

    const restore = async () => {
        if (!pick) return;
        const target = pick;
        try {
            await channelService.restoreChannel(target.id);
        } catch (error) {
            // 404: it is not restorable any more (already restored, erased, or not yours). The
            // row is stale, so take it out and say so; any other failure keeps the dialog open
            // with its message so the person can try again.
            if (error instanceof ChannelServiceError && error.code === "NOT_FOUND") {
                drop(target.id);
                setNotice(fmt(copy.gone, { name: target.title }));
                setPick(null);
                return;
            }
            console.error("[ModalRecentlyDeletedChats] restore failed:", error);
            throw new Error(copy.restoreError);
        }
        drop(target.id);
        setNotice(fmt(copy.restored, { name: target.title }));
        setPick(null);
    };

    return (
        <>
            <ModalFrame
                description={copy.description}
                icon={<RestoreFromTrashRoundedIcon sx={{ color: g.accent.text }} />}
                open={open}
                size="md"
                title={copy.title}
                onClose={onClose}
            >
                {notice && (
                    <Alert color="success" role="status" sx={{ mb: 1.5 }}>
                        {notice}
                    </Alert>
                )}
                <DataState
                    empty={{ title: copy.emptyTitle, body: copy.emptyBody }}
                    error={loadFailed}
                    errorState={{ title: copy.loadError, onRetry: () => void load() }}
                    hasData={rows !== null && rows.length > 0}
                    loading={rows === null && !loadFailed}
                    size="sm"
                    skeleton={<SkeletonRows count={3} />}
                >
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {(rows ?? []).map((row) => (
                            <Box
                                key={row.id}
                                component="li"
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    py: 1,
                                    borderBottom: `1px solid ${g.border.default}`,
                                }}
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography
                                        level="title-sm"
                                        sx={{ color: g.text.primary, overflowWrap: "anywhere" }}
                                    >
                                        {row.title}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: g.text.secondary }}>
                                        {fmt(copy.meta, {
                                            count: row.memberCount,
                                            date: formatDeleted(row.deletedAt),
                                        })}
                                    </Typography>
                                </Box>
                                <Button
                                    aria-label={fmt(copy.restoreAria, { name: row.title })}
                                    size="sm"
                                    variant="outlined"
                                    onClick={() => {
                                        setNotice(null);
                                        setPick(row);
                                    }}
                                >
                                    {copy.restore}
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </DataState>
            </ModalFrame>
            <ConfirmDialog
                cancelLabel={copy.cancel}
                confirmLabel={copy.confirm}
                description={copy.confirmDescription}
                entityName={pick?.title}
                hostZIndex={10010}
                icon={<RestoreFromTrashRoundedIcon sx={{ color: g.accent.text }} />}
                open={pick !== null}
                title={copy.confirmTitle}
                closeOnConfirm
                onClose={() => setPick(null)}
                onConfirm={restore}
            />
        </>
    );
};
