/**
 * "Remind me about this to-do" — the three calls behind the row's menu.
 *
 * Two things set this file apart from its siblings here (`todoItems`,
 * `todoCategories`, …):
 *
 * 1. **Set and cancel THROW.** The others log and resolve `undefined`,
 *    which suits a fire-and-forget PATCH. Not here: the server can refuse
 *    an instant (past, beyond a year, to-do already ticked off), and the
 *    picker has to tell the user the reminder wasn't set instead of closing
 *    on a promise nobody kept. `loadTodoReminders` keeps the soft-failure
 *    convention — an offline boot should leave the rows unannotated, not
 *    blow up the pane.
 * 2. **The body is camelCase** (`{"remindAt": …}`), unlike every other
 *    to-do endpoint's snake_case, because it is the same body the message
 *    reminder endpoint takes and the same picker sends it.
 */
import axios from "axios";

import { authApi } from "../../../../../services/api";
import { TodoReminderProps } from "../../../../../types/chat";

/**
 * Every pending reminder for the current user, soonest first.
 *
 * The only source: nothing broadcasts reminders and no to-do payload
 * mentions them, so without this read a reminder set before a reload (or on
 * a phone) is invisible — and an invisible reminder is one the user sets a
 * second time. Returns undefined when the read itself failed, which the
 * caller must not confuse with "this user has none".
 */
export const loadTodoReminders = async (
    accessToken: string | null
): Promise<TodoReminderProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.get("/todo/reminders/");
        return (res.data?.reminders ?? []) as TodoReminderProps[];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "loadTodoReminders API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("loadTodoReminders unexpected error:", error);
        }
    }
};

/**
 * Ask to be reminded about `itemId` at `remindAt` — an absolute instant the
 * BROWSER resolved (see `utils/reminderPresets` for why the server never
 * computes "tomorrow 9am" itself). Replaces any pending reminder on the
 * item; rejects when the server refuses the time.
 */
export const setTodoReminder = async (
    accessToken: string | null,
    itemId: number,
    remindAt: Date
): Promise<TodoReminderProps> => {
    const api = authApi(accessToken);
    if (!api) throw new Error("setTodoReminder: not authenticated");
    const res = await api.post(`/todo/items/${itemId}/reminder/`, {
        remindAt: remindAt.toISOString(),
    });
    return res.data.reminder as TodoReminderProps;
};

/** Drop the pending reminder. Idempotent — cancelling one that already
 *  fired is not an error, and the client drops its copy optimistically. */
export const cancelTodoReminder = async (
    accessToken: string | null,
    itemId: number
): Promise<void> => {
    const api = authApi(accessToken);
    if (!api) throw new Error("cancelTodoReminder: not authenticated");
    await api.delete(`/todo/items/${itemId}/reminder/`);
};
