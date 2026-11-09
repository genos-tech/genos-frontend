import { useCallback, useEffect, useRef, useState } from "react";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Box, Button, Stack, Typography } from "@mui/joy";
import { Link } from "react-router-dom";
import { Socket } from "socket.io-client";

import { DataState } from "../../../../../../components/ui/feedback/DataState";
import { useAuth } from "../../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../../../i18n";
import { g } from "../../../../../../theme/tokens";
import { UserProps } from "../../../../../../types/admin";
import {
    TaskActivityProps,
    TaskProgressSourceProps,
    TaskTableProps,
} from "../../../../../../types/tasks";
import { loadTaskProgress } from "../../../../services/loadTaskProgress";
import { TaskActivityFeed } from "./TaskActivityFeed";

const PAGE_SIZE = 30;

type Props = {
    /** The task, or the milestone's own task row. */
    taskId: number;
    projectId: number | null;
    /** Its `lastProgressAt`. It moves whenever anything under the task changes, so
     *  a change in it is the cue to read the feed again (a new key, never a stale
     *  cached page). */
    version: string;
    allTasks: TaskTableProps[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};

// Which task a change happened to: the line above each entry. A live task links
// into the project; a deleted one is only named.
const SourceTaskLine = ({
    source,
    projectId,
    deletedLabel,
}: {
    source: TaskProgressSourceProps;
    projectId: number | null;
    deletedLabel: string;
}) => {
    const label = (
        <>
            <Box component="span" sx={{ fontWeight: 600, mr: 0.75 }}>
                {source.displayId}
            </Box>
            {source.title ?? ""}
        </>
    );
    const sx = {
        display: "block",
        px: 1,
        pt: 1,
        fontSize: "var(--g-type-body-xs-size)",
        color: g.text.secondary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    } as const;
    if (source.isDeleted || projectId == null) {
        return (
            <Typography
                data-testid="progress-source"
                level="body-xs"
                sx={{ ...sx, textDecoration: source.isDeleted ? "line-through" : "none" }}
            >
                {label}
                {source.isDeleted && ` (${deletedLabel})`}
            </Typography>
        );
    }
    return (
        <Typography
            component={Link}
            data-testid="progress-source"
            level="body-xs"
            sx={{ ...sx, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            to={`/workspace/tasks/project/${projectId}/task/${source.id}`}
        >
            {label}
        </Typography>
    );
};

/**
 * What changed UNDER a task or milestone (MIP-1351): its sub-tasks and theirs,
 * newest first, each entry headed by the task it happened to.
 *
 * The task's own changes are in its own Activity feed; this is the other half. Every
 * entry is drawn by `TaskActivityFeed` itself (one row per instance), so a change
 * reads exactly as it does in that task's own history.
 */
export const TaskProgressFeed = ({
    taskId,
    projectId,
    version,
    allTasks,
    myself,
    setMyself,
    socket,
    useTEM,
    useCM,
    useUISM,
}: Props) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    const [entries, setEntries] = useState<TaskActivityProps[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [failed, setFailed] = useState(false);
    // A response for a task (or version) we have since moved off must not land.
    const requestRef = useRef(0);
    const shownTaskRef = useRef<number | null>(null);

    const load = useCallback(async () => {
        const mine = ++requestRef.current;
        // Another task's rows must not stay on screen while this one loads; the
        // same task's rows do (a refresh must not flash the list away).
        if (shownTaskRef.current !== taskId) {
            shownTaskRef.current = taskId;
            setEntries([]);
            setNextCursor(null);
        }
        setLoading(true);
        setFailed(false);
        const page = await loadTaskProgress(accessToken, taskId, {
            minDepth: 1,
            limit: PAGE_SIZE,
            version,
        });
        if (mine !== requestRef.current) return;
        setLoading(false);
        if (page === null) {
            setFailed(true);
            return;
        }
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
    }, [accessToken, taskId, version]);

    useEffect(() => {
        void load();
    }, [load]);

    const loadMore = async () => {
        if (!nextCursor || loadingMore) return;
        const mine = requestRef.current;
        setLoadingMore(true);
        const page = await loadTaskProgress(accessToken, taskId, {
            cursor: nextCursor,
            minDepth: 1,
            limit: PAGE_SIZE,
            version,
        });
        setLoadingMore(false);
        if (mine !== requestRef.current || page === null) return;
        setEntries((prev) => {
            const seen = new Set(prev.map((e) => e.factId));
            return [...prev, ...page.entries.filter((e) => !seen.has(e.factId))];
        });
        setNextCursor(page.nextCursor);
    };

    const progress = t.tasks.activity.progress;
    return (
        <DataState
            empty={{
                body: progress.emptyBody,
                "data-empty": "task-progress",
                icon: <HistoryRoundedIcon />,
                title: progress.empty,
            }}
            error={failed}
            errorState={{
                title: progress.loadFailed,
                onRetry: () => void load(),
                "data-error": "task-progress",
            }}
            hasData={entries.length > 0}
            loading={loading}
            skeleton={null}
        >
            <Stack data-testid="task-progress-feed" spacing={0.5} sx={{ p: 1 }}>
                {entries.map((entry) => (
                    <Box key={entry.factId ?? entry.activityId}>
                        {entry.sourceTask && (
                            <SourceTaskLine
                                deletedLabel={progress.deleted}
                                projectId={projectId}
                                source={entry.sourceTask}
                            />
                        )}
                        <TaskActivityFeed
                            activities={[entry]}
                            allTasks={allTasks}
                            isLoading={false}
                            loadFailed={false}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onRetry={() => undefined}
                        />
                    </Box>
                ))}
                {nextCursor && (
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                        <Button
                            disabled={loadingMore}
                            size="sm"
                            variant="plain"
                            onClick={() => void loadMore()}
                        >
                            {progress.loadMore}
                        </Button>
                    </Box>
                )}
            </Stack>
        </DataState>
    );
};
