import { useEffect, useMemo, useState } from "react";
import { Box, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { loadTodoGroups } from "../../../features/chat/components/todo/services/loadTodoGroups";
import { ToDoPane } from "../../../features/chat/ToDoPane";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UseTodoGroupsState } from "../../../hooks/useTodoGroups";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { TodoTarget } from "../../../utils/parseInternalUrl";

type ModalTodoViewProps = {
    target: TodoTarget;
    onClose: () => void;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTG: UseTodoGroupsState;
};

// Renders the todo pane for a /workspace/todo/:localDate[/item/:itemId]
// deep link. Unlike ModalTaskView this is NOT a snapshot: it renders
// against the shared `useTG`, so edits made in the modal go through the
// same optimistic mutators and stay in sync with the main pane.
//
// What IS modal-local is the All/Incomplete filter: it's initialized
// from the target item's completion (a completed item is invisible on
// the Incomplete tab, so its link must open on All) and the chips write
// a local state, never the host page's global
// `useCM.showOnlyInCompleteTodos`.
export const ModalTodoView = (props: ModalTodoViewProps) => {
    const { target, accessToken, myself, setMyself, socket, useTEM, useUISM, useCM, useTG } =
        props;
    const { t } = useTranslation();

    const targetGroup = useMemo(() => {
        if (target.itemId != null) {
            const byItem = useTG.groups.find((g) =>
                g.items.some((i) => i.itemId === target.itemId)
            );
            if (byItem) return byItem;
        }
        return useTG.groups.find((g) => g.localDate === target.localDate);
    }, [useTG.groups, target.itemId, target.localDate]);
    const targetItem =
        target.itemId != null
            ? targetGroup?.items.find((i) => i.itemId === target.itemId)
            : undefined;

    // Resolution: the default group window (server-side ~1 year lookback,
    // possibly stale IDB fast-path) may not contain the linked day. When
    // the target is missing and the hook isn't mid-load, fetch exactly
    // that day and merge it in; if the fetch comes back empty the link
    // points at something this user can't see (deleted, or another
    // user's todo — the endpoint is owner-scoped) → notFound.
    const [notFound, setNotFound] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const resolved = target.itemId != null ? targetItem !== undefined : targetGroup !== undefined;

    useEffect(() => {
        setNotFound(false);
    }, [target.localDate, target.itemId]);

    // Refresh once per target so a stale IDB-cached completion state
    // doesn't pick the wrong tab below.
    useEffect(() => {
        void useTG.refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target.localDate, target.itemId]);

    useEffect(() => {
        if (resolved || notFound || useTG.isLoading || isResolving) return;
        let cancelled = false;
        setIsResolving(true);
        (async () => {
            const fetched = await loadTodoGroups(
                myself,
                accessToken,
                target.localDate,
                target.localDate
            );
            if (cancelled) return;
            const group = fetched?.find((g) => g.localDate === target.localDate);
            if (group) {
                useTG.setGroups((prev) => {
                    const rest = prev.filter((g) => g.groupId !== group.groupId);
                    return [...rest, group].sort((a, b) => b.localDate.localeCompare(a.localDate));
                });
                // If the fetched day still lacks the item, the next
                // effect run sees resolved=false with fresh groups and
                // falls through to notFound below.
                if (
                    target.itemId != null &&
                    !group.items.some((i) => i.itemId === target.itemId)
                ) {
                    setNotFound(true);
                }
            } else {
                setNotFound(true);
            }
            setIsResolving(false);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolved, notFound, useTG.isLoading, isResolving, target.localDate, target.itemId]);

    // Modal-local All/Incomplete tab. null = not decided yet (don't
    // render the pane until then, so the wrong tab never flashes).
    // Incomplete target → Incomplete tab; completed → All (the
    // Incomplete tab hides it); date-only link → All.
    const [showIncomplete, setShowIncomplete] = useState<boolean | null>(null);
    useEffect(() => {
        if (showIncomplete !== null) return;
        if (target.itemId != null) {
            if (targetItem) setShowIncomplete(!targetItem.isCompleted);
        } else if (targetGroup) {
            setShowIncomplete(false);
        }
    }, [showIncomplete, target.itemId, targetItem, targetGroup]);

    const useCMOverride: ChatManagementState = useMemo(
        () => ({
            ...useCM,
            showOnlyInCompleteTodos: showIncomplete ?? false,
            setShowOnlyInCompleteTodos: setShowIncomplete,
            isSubChatVisible: false,
        }),
        [useCM, showIncomplete]
    );

    if (notFound) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    height: "100%",
                    justifyContent: "center",
                    p: 4,
                    width: "100%",
                }}
            >
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                    {t.common.modalView.todoUnavailable}
                </Typography>
            </Box>
        );
    }

    if (!resolved || showIncomplete === null) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    height: "100%",
                    justifyContent: "center",
                    p: 4,
                    width: "100%",
                }}
            >
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                    {t.common.modalView.loadingTodos}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", overflow: "hidden", width: "100%" }}>
            <ToDoPane
                currentWindowHeight={window.innerHeight}
                focusTarget={{ itemId: target.itemId, localDate: target.localDate }}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCMOverride}
                useTEM={useTEM}
                useTG={useTG}
                useUISM={useUISM}
                hostedInModal
            />
        </Box>
    );
};
