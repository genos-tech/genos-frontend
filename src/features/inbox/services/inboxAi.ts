// The off switch of an AI-made Inbox item (MIP-1227; genos-api MIP-1209):
//
//   POST /inbox/<item_id>/ai/off/   turn the item's source off (the digest, or that schedule)
//   POST /inbox/<item_id>/ai/on/    the undo
//
// The server reads the source from the ITEM, never from this request, so the only thing sent is
// the item id. The answer's `what` sentence is English-only, so the card writes its own words
// (in the member's language) from `wasEnabled`, the kind and the label; an error's sentence is
// shown as it arrived, like the Schedules page does.

import { authApi } from "../../../services/api";

export type AiSwitchResult =
    | {
          ok: true;
          /** The state the source is in now. */
          enabled: boolean;
          /** What it was before the call: an Undo is only honest when this was true. */
          wasEnabled: boolean;
      }
    | {
          ok: false;
          /** `gone`: the schedule was deleted (404). `plan`: the member's plan does not include
           *  it (403 `plan_required`). `error`: anything else. */
          reason: "gone" | "plan" | "error";
          /** The sentence the server wrote, or null when there was none (network, 5xx). */
          error: string | null;
      };

// The card renders every failure inline, so the global toast stays off.
const SILENT = { suppressErrorToast: true } as const;

export const switchInboxAi = async (
    accessToken: string | null,
    itemId: number,
    on: boolean
): Promise<AiSwitchResult> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, reason: "error", error: null };
    try {
        const res = await api.post<{ enabled?: unknown; was_enabled?: unknown }>(
            `/inbox/${itemId}/ai/${on ? "on" : "off"}/`,
            undefined,
            SILENT
        );
        return {
            ok: true,
            enabled: on,
            // Only a clear `true` counts: Undo on something that was already off would turn it ON.
            wasEnabled: res.data?.was_enabled === true,
        };
    } catch (error) {
        const res = (
            error as { response?: { status?: number; data?: { error?: unknown; code?: unknown } } }
        )?.response;
        const sentence = res?.data?.error;
        const error_ = typeof sentence === "string" && sentence.trim() !== "" ? sentence : null;
        if (res?.status === 404 && error_ !== null && /no longer exists/i.test(error_)) {
            return { ok: false, reason: "gone", error: error_ };
        }
        if (res?.status === 403 || res?.data?.code === "plan_required") {
            return { ok: false, reason: "plan", error: error_ };
        }
        return { ok: false, reason: "error", error: res?.status === 404 ? null : error_ };
    }
};
