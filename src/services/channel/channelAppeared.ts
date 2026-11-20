import { channelService } from "./channelService";

/**
 * What genos-sockets sends to a person's own room when a chat became visible to them without a
 * `channel.created` (MIP-1719): a group its owner restored, a group made over REST. Ids only, no
 * title and no member list.
 */
export type ChannelAppearedNotice = {
    teamId: string;
    channelId: string;
    kind: number;
};

/**
 * How long to wait for more notices before reading the list. A restore of one chat sends one
 * notice; a change that makes several chats appear sends one per chat, in a burst.
 */
export const CHANNEL_APPEARED_DEBOUNCE_MS = 250;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
// A notice arrived while the list was being read: that read may have started before the chat
// existed, so it must be read once more after it ends.
let dirty = false;

const isNotice = (value: unknown): value is ChannelAppearedNotice => {
    if (!value || typeof value !== "object") return false;
    const { channelId, kind } = value as Partial<ChannelAppearedNotice>;
    return typeof channelId === "string" && channelId !== "" && typeof kind === "number";
};

async function run(): Promise<void> {
    timer = null;
    running = true;
    try {
        do {
            dirty = false;
            // `refreshChannels`, not `listChannels`: `listChannels` only RETURNS the list. The
            // refresh is what ingests it into the app's store and evicts what the server no longer
            // lists. It does not throw (a failed read is logged and the next sync reconciles);
            // the catch is for the day that stops being true, so a rejection can neither go
            // unhandled nor leave `running` set and silence every later notice.
            try {
                await channelService.refreshChannels();
            } catch (e) {
                console.error("[channel.appeared] chat list refresh failed:", e);
            }
        } while (dirty);
    } finally {
        running = false;
    }
}

/**
 * A chat became visible to this person: re-read the chat list.
 *
 * The notice carries no chat, only that one exists, so the app asks the server (with its own
 * token, so what it may see is still the server's decision). The reads are coalesced twice:
 *
 *  - a burst of notices waits for the quiet (`CHANNEL_APPEARED_DEBOUNCE_MS` after the last one)
 *    and costs one read;
 *  - a notice that arrives while a read is under way asks for one more read when it ends. It
 *    cannot just join the read in flight (`listChannels` shares one): that GET may have left
 *    before the chat was committed, and the notice only exists because it has since been.
 *
 * A malformed notice is ignored. With no notice ever sent (an older sockets) this never runs.
 */
export const handleChannelAppeared = (notice: unknown): void => {
    if (!isNotice(notice)) return;
    if (running) {
        dirty = true;
        return;
    }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => void run(), CHANNEL_APPEARED_DEBOUNCE_MS);
};

/** Drop a read that has not started (socket teardown, tests). One already under way finishes. */
export const cancelChannelAppeared = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    dirty = false;
};
