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
    cancelTodoReminder,
    loadTodoReminders,
    setTodoReminder,
} from "../features/chat/components/todo/services/todoReminders";
import {
    createTodoSchedule,
    CreateTodoScheduleInput,
    deleteTodoSchedule,
    loadTodoSchedules,
    updateTodoSchedule,
    UpdateTodoSchedulePatch,
} from "../features/chat/components/todo/services/todoSchedules";
import { reminderSweepDelayMs } from "../features/chat/utils/reminderSweep";
import { occursOn } from "../features/chat/utils/todoSchedule";
import { requestInboxResync } from "../features/inbox/inboxResyncEvent";
import { UserProps } from "../types/admin";
import {
    TodoCategoryProps,
    TodoGroupProps,
    TodoItemProps,
    TodoReminderProps,
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
    // Pending "remind me about this to-do" nudges, by item.
    //
    // Reminders live HERE rather than in their own store because completion
    // and cancellation are one fact: the server retires a reminder when the
    // to-do is ticked off, so `patchOneItem` has to drop it locally in the
    // same breath. Split across two owners, a completed row would keep
    // promising a nudge that is never coming.
    const [reminderByItemId, setReminderByItemId] = useState<
        ReadonlyMap<number, TodoReminderProps>
    >(() => new Map());

    // Ref so handlers always see the latest groups without re-binding.
    const groupsRef = useRef<TodoGroupProps[]>([]);
    groupsRef.current = groups;
    // Same for schedules — the materializer reads them from a ref so the
    // effects that call it don't need `schedules` in their dep arrays.
    const schedulesRef = useRef<TodoScheduleProps[]>([]);
    schedulesRef.current = schedules;
    // And for reminders, so the mutators below can read the current one
    // without taking the map as a dependency — it changes whenever any
    // reminder is set or fires, which would re-bind every item handler.
    const remindersRef = useRef<ReadonlyMap<number, TodoReminderProps>>(new Map());
    remindersRef.current = reminderByItemId;

    // Load: IDB fast path, then authoritative fetch.
    //
    // Identity guard: since the App-root lift (the hook used to live in
    // ChatHome, which only mounts post-auth) the first render can run
    // with an empty `myself` — an unguarded fetch then hits
    // /todo/groups/?team_id= and 500s on the server's UUID validation.
    useEffect(() => {
        if (!myself.userId || !myself.teamId) return;
        let cancelled = false;
        // Reminders ride alongside rather than inside the `Promise.all`
        // below: they only annotate rows that are perfectly usable without
        // them, so putting them in the batch would make the list the user
        // actually opened wait on the decoration over it.
        //
        // `undefined` means the read FAILED, which is not the same as "no
        // reminders" — keep whatever we had rather than telling the user
        // theirs are gone.
        void loadTodoReminders(accessToken).then((reminders) => {
            if (!cancelled && reminders) {
                setReminderByItemId(new Map(reminders.map((r) => [r.itemId, r])));
            }
        });
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

    // `localDate` is the date the CALLER asked the server to file this item
    // under, for the stub below. It's optional only because the callers that
    // can't know it (a patch response for an item already on screen) never
    // reach the stub branch — but where a group is genuinely new, guessing
    // today is wrong: a to-do created for TOMORROW would show up under
    // today's date, complete with the "(Today)" label, until the follow-up
    // load corrected it. That flash is the whole reason this is a parameter.
    const upsertItem = useCallback((item: TodoItemProps, localDate?: string) => {
        setGroups((prev) => {
            const idx = prev.findIndex((g) => g.groupId === item.groupId);
            if (idx === -1) {
                // Group was just created server-side; we don't have its
                // metadata locally. Insert a stub; a refresh will fill in
                // localDate / timestamps on the next load.
                const stub: TodoGroupProps = {
                    groupId: item.groupId,
                    localDate: localDate ?? getLocalCurrentDate(),
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
            if (created) upsertItem(created, input.localDate);
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

    // Forget this item's pending reminder. Declared here, above the item
    // mutators that call it: completing or deleting a to-do retires its
    // reminder server-side, and the local map has to follow or the row goes
    // on promising a nudge that will never arrive.
    const dropReminderLocally = useCallback((itemId: number) => {
        setReminderByItemId((prev) => {
            if (!prev.has(itemId)) return prev; // no re-render for the common case
            const next = new Map(prev);
            next.delete(itemId);
            return next;
        });
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

            // Mirror the server's own rule (`todo_views.patch` calls
            // `todo_reminders.cancel_pending`): finishing the to-do retires
            // the nudge. Done optimistically alongside the completion so the
            // row never shows "done" and "Reminder: 15:00" together.
            const droppedReminder =
                patch.isCompleted === true ? remindersRef.current.get(itemId) : undefined;
            if (patch.isCompleted === true) dropReminderLocally(itemId);

            const fresh = await updateTodoItem(accessToken, itemId, patch);
            if (!fresh) {
                // The PATCH never landed, so the server never cancelled
                // anything — put the reminder back with the item.
                if (droppedReminder) {
                    setReminderByItemId((prev) => new Map(prev).set(itemId, droppedReminder));
                }
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
        [accessToken, dropReminderLocally, upsertItem]
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

    /** Move a to-do to another day — carrying over the leftovers of a day.
     *
     *  Deliberately NOT a `patchItem({ localDate })`: every other patch
     *  leaves the item in the group it's already in, and `upsertItem` finds
     *  that group by the item's `groupId`. A move changes `groupId`, so
     *  upserting the response would ADD the item to the target group while
     *  leaving the original behind — the same to-do on two days at once.
     *
     *  Subitems follow their parent server-side, and they're not in the
     *  response (only the parent is), so they're moved here to match rather
     *  than left pointing at the day their parent just left. `refresh()`
     *  afterwards is what gets the real group metadata: a brand-new target
     *  day arrives as a stub, and both days' completion flags are the
     *  server's to decide. */
    const moveItem = useCallback(
        async (itemId: number, localDate: string): Promise<boolean> => {
            const moved = await updateTodoItem(accessToken, itemId, { localDate });
            // No optimistic pass: the group this lands in may not exist yet,
            // and a failed move that had already redrawn two days is a worse
            // lie than a move that takes a moment to appear.
            if (!moved) return false;
            setGroups((prev) => {
                const childIds = new Set(
                    prev
                        .flatMap((g) => g.items)
                        .filter((i) => i.parentItemId === itemId)
                        .map((i) => i.itemId)
                );
                const children = prev
                    .flatMap((g) => g.items)
                    .filter((i) => childIds.has(i.itemId))
                    .map((i) => ({ ...i, groupId: moved.groupId }));
                const withoutMoved = prev.map((g) =>
                    recomputeGroupCompletion({
                        ...g,
                        items: g.items.filter(
                            (i) => i.itemId !== itemId && !childIds.has(i.itemId)
                        ),
                    })
                );
                const idx = withoutMoved.findIndex((g) => g.groupId === moved.groupId);
                if (idx === -1) {
                    const stub: TodoGroupProps = {
                        groupId: moved.groupId,
                        localDate,
                        isCompleted: false,
                        items: [moved, ...children],
                        tsCreatedAt: moved.tsCreatedAt,
                        tsUpdatedAt: moved.tsUpdatedAt,
                    };
                    return [stub, ...withoutMoved];
                }
                const target = withoutMoved[idx];
                const updated = recomputeGroupCompletion({
                    ...target,
                    items: [...target.items, moved, ...children],
                });
                return [...withoutMoved.slice(0, idx), updated, ...withoutMoved.slice(idx + 1)];
            });
            // Reconcile: group ordering is the server's (`-local_date`), and
            // an emptied source day may now be gone from the window.
            const fresh = await loadTodoGroups(myself, accessToken);
            if (fresh) setGroups(fresh);
            return true;
        },
        [accessToken, myself]
    );

    const removeItem = useCallback(
        async (itemId: number): Promise<boolean> => {
            removeItemLocally(itemId);
            // The server cascades the reminder away with the row; without
            // this the map would keep a reminder for a to-do that no longer
            // exists, and its sweep timer would keep re-arming for it.
            dropReminderLocally(itemId);
            const ok = await deleteTodoItem(accessToken, itemId);
            if (!ok) {
                // Reload on failure since we have no snapshot for revert.
                const fresh = await loadTodoGroups(myself, accessToken);
                if (fresh) setGroups(fresh);
            }
            return ok;
        },
        [accessToken, dropReminderLocally, myself, removeItemLocally]
    );

    const refreshReminders = useCallback(async () => {
        const reminders = await loadTodoReminders(accessToken);
        if (!reminders) return; // read failed — keep what we have
        setReminderByItemId(new Map(reminders.map((r) => [r.itemId, r])));
    }, [accessToken]);

    /** Ask to be reminded about this to-do at `at`. Rejects when the server
     *  refuses the time, so the picker can say so. */
    const setItemReminder = useCallback(
        async (itemId: number, at: Date): Promise<TodoReminderProps> => {
            const reminder = await setTodoReminder(accessToken, itemId, at);
            setReminderByItemId((prev) => new Map(prev).set(itemId, reminder));
            return reminder;
        },
        [accessToken]
    );

    /** Cancel it. Optimistic, restoring the row if the server refuses —
     *  a reminder that silently survives its own cancellation is the worse
     *  of the two failures. */
    const cancelItemReminder = useCallback(
        async (itemId: number): Promise<void> => {
            const existing = remindersRef.current.get(itemId);
            dropReminderLocally(itemId);
            try {
                await cancelTodoReminder(accessToken, itemId);
            } catch (e) {
                if (existing) {
                    setReminderByItemId((prev) => new Map(prev).set(itemId, existing));
                }
                throw e;
            }
        },
        [accessToken, dropReminderLocally]
    );

    // Re-read once the soonest reminder's time has passed, so a row stops
    // promising a nudge that has already been delivered (or was retired as
    // moot). One timer for the whole set — see `utils/reminderSweep`.
    //
    // The same moment is also the only signal this client gets that a
    // reminder has fired: the cron files the inbox item with no acting
    // client to relay a socket event, so nothing announces it. Hence the
    // second call — see `features/inbox/inboxResyncEvent`. Asked for
    // unconditionally rather than only when a reminder actually vanished
    // from the set: the two reads race (this one may win), and a resync
    // that finds nothing new is a `?since=` request that notifies nobody.
    useEffect(() => {
        const delay = reminderSweepDelayMs(
            Array.from(reminderByItemId.values(), (r) => r.remindAt)
        );
        if (delay === null) return;
        const id = setTimeout(() => {
            void refreshReminders();
            requestInboxResync("reminder-sweep");
        }, delay);
        return () => clearTimeout(id);
    }, [reminderByItemId, refreshReminders]);

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

    // Schedules this session has already claimed for materialization,
    // keyed `${scheduleId}:${localDate}`. This is the ONLY guard that
    // holds against two materialize passes running concurrently — the
    // `lastMaterializedDate` cursor and the title-match set below are both
    // only observable AFTER their awaited writes land, so two passes that
    // start before either commits (e.g. the midnight timer firing while a
    // token-refresh re-runs the load effect) would each create the item.
    // The claim is taken SYNCHRONOUSLY, before any await, so the second
    // pass sees it with no gap to race through. Keyed by date, so it
    // self-expires across days without a midnight reset.
    const materializedClaimsRef = useRef<Set<string>>(new Set());

    // Create a todo item for every active schedule that is due today and
    // hasn't fired yet. Idempotent on three levels: the synchronous
    // in-session claim above (guards concurrent passes), the authoritative
    // `lastMaterializedDate` cursor (skip if it already equals today), and
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

                // Claim this schedule for today BEFORE the awaits below. If
                // a concurrent pass already claimed it, skip entirely — that
                // pass owns both the create and the cursor advance.
                const claimKey = `${sched.scheduleId}:${today}`;
                if (materializedClaimsRef.current.has(claimKey)) continue;
                materializedClaimsRef.current.add(claimKey);

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
        moveItem,
        removeItem,
        addCategory,
        renameCategory,
        removeCategory,
        addSchedule,
        updateSchedule,
        removeSchedule,
        refresh,
        reminderByItemId,
        setItemReminder,
        cancelItemReminder,
        refreshReminders,
    };
};
