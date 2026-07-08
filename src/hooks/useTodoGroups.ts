import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";

import { TodoService } from "../db/services/todo.service";
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
import { UserProps } from "../types/admin";
import { TodoCategoryProps, TodoGroupProps, TodoItemProps } from "../types/chat";
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

export const useTodoGroups = (
    myself: UserProps,
    accessToken: string | null,
    isToDoVisible: boolean
) => {
    const [groups, setGroups] = useState<TodoGroupProps[]>([]);
    const [categories, setCategories] = useState<TodoCategoryProps[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Ref so handlers always see the latest groups without re-binding.
    const groupsRef = useRef<TodoGroupProps[]>([]);
    groupsRef.current = groups;

    // Load: IDB fast path, then authoritative fetch.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const cached = await todoService.getGroupsByUser(myself.userId);
            if (!cancelled && cached.length > 0) {
                setGroups(cached);
            }
            const [fresh, cats] = await Promise.all([
                loadTodoGroups(myself, accessToken),
                loadTodoCategories(accessToken, myself),
            ]);
            if (!cancelled && fresh) {
                setGroups(fresh);
            }
            if (!cancelled && cats) {
                setCategories(cats);
            }
            if (!cancelled) setIsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [myself.userId, myself.teamId, accessToken, isToDoVisible]);

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

    // Re-evaluate "today" at midnight so a multi-day session keeps
    // `todayGroup` correct without manual refresh.
    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout>;
        const scheduleNextMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            timerId = setTimeout(() => {
                // Force a memo recomputation by writing a new array ref.
                setGroups((prev) => prev.slice());
                scheduleNextMidnight();
            }, tomorrow.getTime() - now.getTime());
        };
        scheduleNextMidnight();
        return () => clearTimeout(timerId);
    }, []);

    const refresh = useCallback(async () => {
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
        todayGroup,
        incompleteCount,
        isLoading,
        addItem,
        patchItem,
        removeItem,
        addCategory,
        renameCategory,
        removeCategory,
        refresh,
    };
};
