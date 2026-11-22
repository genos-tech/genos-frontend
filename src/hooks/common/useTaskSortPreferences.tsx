import { ReactNode, useCallback, useState } from "react";

import { SortTier } from "../../features/tasks/utils/sortTask";
import {
    DEFAULT_SPRINT_BOARD_TIERS,
    DEFAULT_TABLE_TIERS,
    readTiers,
    sanitizeTiers,
    SPRINT_BOARD_STORAGE_KEY,
    TABLE_STORAGE_KEY,
    TableSortOverride,
    TaskSortPreferencesContext,
} from "./taskSortPreferencesState";

export const TaskSortPreferencesProvider = ({ children }: { children: ReactNode }) => {
    const [sprintBoardSortTiers, setSprintBoardSortTiersState] = useState<SortTier[]>(() =>
        readTiers(SPRINT_BOARD_STORAGE_KEY, DEFAULT_SPRINT_BOARD_TIERS)
    );
    const [tableSortTiers, setTableSortTiersState] = useState<SortTier[]>(() =>
        readTiers(TABLE_STORAGE_KEY, DEFAULT_TABLE_TIERS)
    );

    const [tableSortOverride, setTableSortOverrideState] = useState<TableSortOverride | null>(
        null
    );

    const setTableSortOverride = useCallback(
        (tiers: SortTier[] | null, projectId: number | null) => {
            setTableSortOverrideState(
                tiers == null ? null : { tiers: sanitizeTiers(tiers), projectId }
            );
        },
        []
    );

    const setSprintBoardSortTiers = useCallback((tiers: SortTier[]) => {
        const sanitized = sanitizeTiers(tiers);
        setSprintBoardSortTiersState(sanitized);
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(SPRINT_BOARD_STORAGE_KEY, JSON.stringify(sanitized));
            } catch {
                // ignore
            }
        }
    }, []);

    const setTableSortTiers = useCallback((tiers: SortTier[]) => {
        const sanitized = sanitizeTiers(tiers);
        setTableSortTiersState(sanitized);
        // Saving from the modal is an explicit choice: it replaces any
        // temporary header-click sort.
        setTableSortOverrideState(null);
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(sanitized));
            } catch {
                // ignore
            }
        }
    }, []);

    return (
        <TaskSortPreferencesContext.Provider
            value={{
                sprintBoardSortTiers,
                setSprintBoardSortTiers,
                tableSortTiers,
                setTableSortTiers,
                tableSortOverride,
                setTableSortOverride,
            }}
        >
            {children}
        </TaskSortPreferencesContext.Provider>
    );
};
