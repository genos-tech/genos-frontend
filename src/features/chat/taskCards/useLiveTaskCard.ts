import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useAuth } from "../../../context/authState";
import { ensureTaskCard, getTaskCard, subscribeTaskCard, TaskCardEntry } from "./taskCardStore";

export const useLiveTaskCard = (
    taskId: number,
    messageStamp: string,
    viewerId: string
): TaskCardEntry | undefined => {
    const { accessToken } = useAuth();
    const subscribe = useCallback((cb: () => void) => subscribeTaskCard(taskId, cb), [taskId]);
    const entry = useSyncExternalStore(subscribe, () => getTaskCard(taskId));
    useEffect(() => {
        ensureTaskCard(taskId, messageStamp, { accessToken, userId: viewerId });
    }, [taskId, messageStamp, accessToken, viewerId]);
    return entry;
};
