import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { TodoService } from "../db/services/todo.service";
import { parseRecurrence } from "../features/calendar/utils/rrule";
import { loadTodoGroups } from "../features/chat/components/todo/services/loadTodoGroups";
import {
    createTodoCategory,
    deleteTodoCategory,
    loadTodoCategories,
    updateTodoCategory,
} from "../features/chat/components/todo/services/todoCategories";
import {
    createTodoItem,
    CreateTodoItemInput,
    deleteTodoItem,
    updateTodoItem,
    UpdateTodoItemPatch,
} from "../features/chat/components/todo/services/todoItems";
import {
    createTodoSchedule,
    CreateTodoScheduleInput,
    deleteTodoSchedule,
    loadTodoSchedules,
    updateTodoSchedule,
    UpdateTodoSchedulePatch,
} from "../features/chat/components/todo/services/todoSchedules";
import { occursOn } from "../features/chat/utils/todoSchedule";
import { UserProps } from "../types/admin";
import {
    TodoCategoryProps,
    TodoGroupProps,
    TodoItemProps,
    TodoScheduleProps,
} from "../types/chat";
import { getLocalCurrentDate } from "../utils/dateUtils";

const todoService = new TodoService();

const recomputeGroupCompletion = (group: TodoGroupProps): TodoGroupProps => {
    const items = group.items ?? [];
    return {
        ...group,
        items,
        isCompleted: items.length > 0 && items.every((i) => i.isCompleted),
    };
};

export type UseTodoGroupsState = ReturnType<typeof useTodoGroups>;

export const useTodoGroups = (myself: UserProps, accessToken: string | null) => {
    const [groups, setGroups] = useState<TodoGroupProps[]>([]);
    const [categories, setCategories] = useState<TodoCategoryProps[]>([]);
    const [schedules, setSchedules] = useState<TodoScheduleProps[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Ref so handlers always see the latest groups without re-binding.
    const groupsRef = useRef<TodoGroupProps[]>([]);
    groupsRef.current = groups;
    // Same for schedules — the materializer reads them from a ref so the
    // effects that call it don't need `schedules` in their dep arrays.
    const schedulesRef = useRef<TodoScheduleProps[]>([]);
    schedulesRef.current = schedules;

    // Load: IDB fast path, then authoritative fetch.
    //
    // Identity guard: since the App-root lift (the hook used to live in
    // ChatHome, which only mounts post-auth) the first render can run
    // with an empty `myself` — an unguarded fetch then hits
    // /todo/groups/?team_id= and 500s on the server's UUID validation.
    useEffect(() => {
        if (!myself.userId || !myself.teamId) return;
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const cached = await todoService.getGroupsByUser(myself.userId);
            if (!cancelled && cached.length > 0) {
                setGroups(cached);
            }
            const [fresh, cats, scheds] = await Promise.all([
                loadTodoGroups(myself, accessToken),
                loadTodoCategories(accessToken, myself),
                loadTodoSchedules(accessToken, myself),
            ]);
            if (!cancelled && fresh) {
                setGroups(fresh);
            }
            if (!cancelled && cats) {
                setCategories(cats);
            }
            if (!cancelled && scheds) {
                setSchedules(scheds);
            }
            if (!cancelled) setIsLoading(false);
            // Materialize any schedules due today now that both groups and
            // schedules are loaded. Deliberately after `setIsLoading(false)`
            // — it's a background top-up, not part of the initial render's
            // critical path, and it reads the freshly-fetched data via refs.
            if (!cancelled && fresh && scheds) {
                void materializeDueSchedules(fresh, scheds);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myself.userId, myself.teamId, accessToken]);

    // Persist any non-empty state to IDB.
    useEffect(() => {
        if (groups.length > 0) {
            todoService.cacheGroups(groups, myself.userId);
        }
    }, [groups, myself.userId]);

    // Today's group (or undefined if none yet — lazy creation).
    const todayGroup = useMemo(() => {
        const today = getLocalCurrentDate();
        return groups.find((g) => g.localDate === today);
    }, [groups]);

    // Count of incomplete items across all visible groups. Defensive
    // against malformed cached records (e.g. stale IDB rows from a prior
    // schema where `items` wasn't a column).
    const incompleteCount = useMemo(
        () =>
            groups.reduce(
                (acc, g) => acc + (g.items ?? []).filter((i) => !i.isCompleted).length,
                0
            ),
        [groups]
    );

    // Mutators -----------------------------------------------------------

    const upsertItem = useCallback((item: TodoItemProps) => {
        setGroups((prev) => {
            const idx = prev.findIndex((g) => g.groupId === item.groupId);
            if (idx === -1) {
                // Group was just created server-side; we don't have its
                // metadata locally. Insert a stub; a refresh will fill in
                // localDate / timestamps on the next load.
                const stub: TodoGroupProps = {
                    groupId: item.groupId,
                    localDate: getLocalCurrentDate(),
                    isCompleted: item.isCompleted,
                    items: [item],
                    tsCreatedAt: item.tsCreatedAt,
                    tsUpdatedAt: item.tsUpdatedAt,
                };
                return [stub, ...prev];
            }
            const existing = prev[idx];
            const items = existing.items.some((i) => i.itemId === item.itemId)
                ? existing.items.map((i) => (i.itemId === item.itemId ? item : i))
                : [...existing.items, item];
            const updated = recomputeGroupCompletion({ ...existing, items });
            return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
        });
    }, []);

    const addItem = useCallback(
        async (input: CreateTodoItemInput): Promise<TodoItemProps | undefined> => {
            const created = await createTodoItem(accessToken, myself, input);
            if (created) upsertItem(created);
            // Re-fetch groups when the server created a brand-new group
            // for this date, so we get its real metadata (timestamps,
            // localDate) instead of the stub.
            if (created && !groupsRef.current.some((g) => g.groupId === created.groupId)) {
                const fresh = await loadTodoGroups(myself, accessToken);
                if (fresh) setGroups(fresh);
            }
            return created;
        },
        [accessToken, myself, upsertItem]
    );

    const removeItemLocally = useCallback((itemId: number) => {
        setGroups((prev) =>
            prev.map((g) => {
                if (!g.items.some((i) => i.itemId === itemId)) return g;
                return recomputeGroupCompletion({
                    ...g,
                    items: g.items.filter((i) => i.itemId !== itemId),
                });
            })
        );
    }, []);

    // Patch a single item: optimistic local update first, then persist,
    // reverting that one item on server failure.
    const patchOneItem = useCallback(
        async (itemId: number, patch: UpdateTodoItemPatch): Promise<TodoItemProps | undefined> => {
            // Optimistic update: apply locally first.
            let prevSnapshot: TodoItemProps | undefined;
            setGroups((prev) =>
                prev.map((g) => {
                    if (!g.items.some((i) => i.itemId === itemId)) return g;
                    return recomputeGroupCompletion({
                        ...g,
                        items: g.items.map((i) => {
                            if (i.itemId !== itemId) return i;
                            prevSnapshot = i;
                            return {
                                ...i,
                                title: patch.title ?? i.title,
                                notes: patch.notes !== undefined ? patch.notes : i.notes,
                                isCompleted: patch.isCompleted ?? i.isCompleted,
                                // Mirror the server's own rule
                                // (`todo_views.py` stamps / clears
                                // `ts_completed_at` on every toggle) so
                                // the Completed Today view picks the item
                                // up on the optimistic pass instead of
                                // waiting for the response to land.
                                tsCompletedAt:
                                    patch.isCompleted === undefined
                                        ? i.tsCompletedAt
                                        : patch.isCompleted
                                          ? (i.tsCompletedAt ?? new Date().toISOString())
                                          : null,
                                categoryId:
                                    patch.categoryId !== undefined
                                        ? patch.categoryId
                                        : i.categoryId,
                                sortOrder: patch.sortOrder ?? i.sortOrder,
                            };
                        }),
                    });
                })
            );

            const fresh = await updateTodoItem(accessToken, itemId, patch);
            if (!fresh) {
                // Revert on failure.
                if (prevSnapshot) {
                    setGroups((prev) =>
                        prev.map((g) => {
                            if (!g.items.some((i) => i.itemId === itemId)) return g;
                            return recomputeGroupCompletion({
                                ...g,
                                items: g.items.map((i) =>
                                    i.itemId === itemId ? prevSnapshot! : i
                                ),
                            });
                        })
                    );
                }
                return;
            }
            upsertItem(fresh);
            return fresh;
        },
        [accessToken, upsertItem]
    );

    // Public patch. Completing a PARENT cascades completion down to its
    // still-open children, so closing a parent never leaves open subitems
    // behind — a todo's done-state follows its parent; we don't hold a
    // parent "open" on account of its children. Only cascades on
    // completion (`isCompleted === true`); re-opening a parent leaves
    // children as they are, and every other patch (title / notes /
    // category) passes straight through. One-level nesting means children
    // have no children, so there's nothing to recurse into.
    const patchItem = useCallback(
        async (itemId: number, patch: UpdateTodoItemPatch): Promise<TodoItemProps | undefined> => {
            if (patch.isCompleted === true) {
                const group = groupsRef.current.find((g) =>
                    g.items.some((i) => i.itemId === itemId)
                );
                const openChildren = (group?.items ?? []).filter(
                    (i) => i.parentItemId === itemId && !i.isCompleted
                );
                for (const child of openChildren) {
                    void patchOneItem(child.itemId, { isCompleted: true });
                }
            }
            return patchOneItem(itemId, patch);
        },
        [patchOneItem]
    );

    const removeItem = useCallback(
        async (itemId: number): Promise<boolean> => {
            removeItemLocally(itemId);
            const ok = await deleteTodoItem(accessToken, itemId);
            if (!ok) {
                // Reload on failure since we have no snapshot for revert.
                const fresh = await loadTodoGroups(myself, accessToken);
                if (fresh) setGroups(fresh);
            }
            return ok;
        },
        [accessToken, myself, removeItemLocally]
    );

    const addCategory = useCallback(
        async (name: string): Promise<TodoCategoryProps | undefined> => {
            const created = await createTodoCategory(accessToken, myself, name);
            if (created) {
                setCategories((prev) => {
                    if (prev.some((c) => c.categoryId === created.categoryId)) return prev;
                    return [...prev, created];
                });
            }
            return created;
        },
        [accessToken, myself]
    );

    const renameCategory = useCallback(
        async (categoryId: number, name: string) => {
            const updated = await updateTodoCategory(accessToken, categoryId, { name });
            if (updated) {
                setCategories((prev) =>
                    prev.map((c) => (c.categoryId === categoryId ? updated : c))
                );
            }
        },
        [accessToken]
    );

    const removeCategory = useCallback(
        async (categoryId: number) => {
            const ok = await deleteTodoCategory(accessToken, categoryId);
            if (ok) {
                setCategories((prev) => prev.filter((c) => c.categoryId !== categoryId));
                // Items previously linked to this category now have
                // category_id=null on the server (SET_NULL). Refetch
                // groups so the local view matches.
                const fresh = await loadTodoGroups(myself, accessToken);
                if (fresh) setGroups(fresh);
            }
        },
        [accessToken, myself]
    );

    // Schedules (recurring todos) --------------------------------------

    // Create a todo item for every active schedule that is due today and
    // hasn't fired yet. Idempotent on two levels: the authoritative
    // `lastMaterializedDate` cursor (skip if it already equals today) and
    // a title-match guard against today's group (covers a prior run that
    // created the item but failed to advance the cursor). The cursor is
    // advanced even when the item was already present so a delete-then-
    // reopen the same day doesn't resurrect it.
    const materializeDueSchedules = useCallback(
        async (
            currentGroups: TodoGroupProps[] = groupsRef.current,
            currentSchedules: TodoScheduleProps[] = schedulesRef.current
        ) => {
            const today = getLocalCurrentDate();
            const todayGroup = currentGroups.find((g) => g.localDate === today);
            const existingTitles = new Set((todayGroup?.items ?? []).map((i) => i.title));

            for (const sched of currentSchedules) {
                if (!sched.isActive) continue;
                if (sched.lastMaterializedDate === today) continue;
                const spec = parseRecurrence([sched.rrule]);
                if (!occursOn(spec, sched.startDate, today)) continue;

                if (!existingTitles.has(sched.title)) {
                    await addItem({
                        localDate: today,
                        title: sched.title,
                        categoryId: sched.categoryId,
                    });
                    existingTitles.add(sched.title);
                }
                // Advance the cursor (and reflect it locally) whether or
                // not we just created the item.
                const updated = await updateTodoSchedule(accessToken, sched.scheduleId, {
                    lastMaterializedDate: today,
                });
                if (updated) {
                    setSchedules((prev) =>
                        prev.map((s) => (s.scheduleId === sched.scheduleId ? updated : s))
                    );
                }
            }
        },
        [accessToken, addItem]
    );

    // Latest materializer in a ref so the once-mounted midnight timer can
    // call the current one without being torn down and rebuilt each time
    // the callback's identity changes.
    const materializeRef = useRef(materializeDueSchedules);
    materializeRef.current = materializeDueSchedules;

    const addSchedule = useCallback(
        async (input: CreateTodoScheduleInput): Promise<TodoScheduleProps | undefined> => {
            const created = await createTodoSchedule(accessToken, myself, input);
            if (created) {
                setSchedules((prev) => [created, ...prev]);
                // A schedule due today populates immediately rather than
                // waiting for the next app-open / midnight tick.
                void materializeDueSchedules(groupsRef.current, [created]);
            }
            return created;
        },
        [accessToken, myself, materializeDueSchedules]
    );

    const updateSchedule = useCallback(
        async (
            scheduleId: number,
            patch: UpdateTodoSchedulePatch
        ): Promise<TodoScheduleProps | undefined> => {
            const updated = await updateTodoSchedule(accessToken, scheduleId, patch);
            if (updated) {
                setSchedules((prev) =>
                    prev.map((s) => (s.scheduleId === scheduleId ? updated : s))
                );
                // Re-enabling or re-timing a rule may make it due today.
                void materializeDueSchedules(groupsRef.current, [updated]);
            }
            return updated;
        },
        [accessToken, materializeDueSchedules]
    );

    const removeSchedule = useCallback(
        async (scheduleId: number): Promise<boolean> => {
            const ok = await deleteTodoSchedule(accessToken, scheduleId);
            if (ok) {
                setSchedules((prev) => prev.filter((s) => s.scheduleId !== scheduleId));
            }
            return ok;
        },
        [accessToken]
    );

    // Re-evaluate "today" at midnight so a multi-day session keeps
    // `todayGroup` correct without manual refresh — and materialize any
    // schedules that just became due for the new day.
    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout>;
        const scheduleNextMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            timerId = setTimeout(() => {
                // Force a memo recomputation by writing a new array ref.
                setGroups((prev) => prev.slice());
                void materializeRef.current();
                scheduleNextMidnight();
            }, tomorrow.getTime() - now.getTime());
        };
        scheduleNextMidnight();
        return () => clearTimeout(timerId);
    }, []);

    const refresh = useCallback(async () => {
        // Same identity guard as the load effect above.
        if (!myself.userId || !myself.teamId) return;
        const fresh = await loadTodoGroups(myself, accessToken);
        if (fresh) setGroups(fresh);
    }, [accessToken, myself]);

    // External invalidator: anything that mutates todos outside the
    // hook (currently the Spotlight agent's create/update_todo_item
    // tools) dispatches `window` event `todoChanged` so the pane
    // catches up without a manual reload.
    useEffect(() => {
        const handler = () => {
            void refresh();
        };
        window.addEventListener("todoChanged", handler);
        return () => window.removeEventListener("todoChanged", handler);
    }, [refresh]);

    return {
        groups,
        setGroups,
        categories,
        schedules,
        todayGroup,
        incompleteCount,
        isLoading,
        addItem,
        patchItem,
        removeItem,
        addCategory,
        renameCategory,
        removeCategory,
        addSchedule,
        updateSchedule,
        removeSchedule,
        refresh,
    };
};
