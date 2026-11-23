import { rememberedPerson, rememberPeople } from "../../../components/ui/avatars/userDirectory";
import type { InboxItemProps } from "../../../types/common";
import { GM_REQUEST, NOTE_ACCESS_REQUEST, PROJECT_REQUEST, TEAM_REQUEST } from "./inboxItemConfig";

/** The person a card is about: who is asking, or who did the thing. `avatarImgPath` is set only
 *  when the API sent the sender (it is what lets the face show for someone outside the roster). */
export type InboxActor = { userId: string; userName: string; avatarImgPath?: string };

type Inline = { type?: string; props?: Record<string, unknown> };
type Block = { content?: unknown };

/**
 * The first person MENTIONED in a card's body.
 *
 * The sockets service and the API write a request or an activity as BlockNote blocks whose first
 * paragraph opens with a `mention` node for the person ("@Sam wants to join ..."). The inbox GET
 * does not send the sender's id, so the body is where the card finds who it is about. Reading it
 * costs no new data and works for every row already in an inbox.
 *
 * Null when the body is not blocks (a digest, a report, a reminder), has no mention, or the
 * mention has no id. The caller then shows the type's mark instead of a face.
 */
export const findActor = (itemBody: InboxItemProps["itemBody"]): InboxActor | null => {
    if (!Array.isArray(itemBody)) return null;
    for (const block of itemBody as Block[]) {
        if (!Array.isArray(block?.content)) continue;
        for (const node of block.content as Inline[]) {
            if (node?.type !== "mention") continue;
            const userId = node.props?.userId;
            if (userId == null || String(userId) === "") return null;
            return { userId: String(userId), userName: String(node.props?.userName ?? "") };
        }
        // Only the opening paragraph names the person; a later mention is something they said.
        return null;
    }
    return null;
};

/**
 * The person a card is about: the sender the API names (MIP-2181), else the first person mentioned
 * in the body (a row stored before the API sent senders, or delivered live without one).
 *
 * The sender wins when both exist: it is the row's own column, whereas a mention is text someone
 * wrote. It is what gives the ownership claim, the cross-team notices and the reminders a face,
 * since their bodies name nobody. Null when there is neither, and the card shows its type's mark.
 */
export const resolveActor = (
    item: Pick<InboxItemProps, "itemBody" | "senderId" | "sender">
): InboxActor | null => {
    const id = item.sender?.userId ?? item.senderId;
    if (id != null && String(id) !== "") {
        const fromBody = findActor(item.itemBody);
        const name = item.sender?.userName ?? "";
        return {
            userId: String(id),
            // The sender's name, else the body's mention of the same person.
            userName:
                name !== ""
                    ? name
                    : fromBody && fromBody.userId === String(id)
                      ? fromBody.userName
                      : "",
            avatarImgPath: item.sender?.avatarImgPath ?? undefined,
        };
    }
    return findActor(item.itemBody);
};

/**
 * Teach the avatar directory the sender a LIVE card names (MIP-2182).
 *
 * A pushed card carries the sender as the API reads them now, so unlike a stored card it may
 * replace what the directory holds: this is how a rename or a new photo reaches the open inbox
 * without a reload. The roster still wins for anyone in it. Keeps the email a chat payload already
 * taught the directory (this payload has none). Does nothing for a card nobody sent.
 */
export const rememberInboxSender = (item: Pick<InboxItemProps, "sender">): void => {
    const sender = item.sender;
    if (!sender?.userId) return;
    rememberPeople([
        {
            userId: sender.userId,
            userName: sender.userName,
            userEmail: rememberedPerson(sender.userId)?.userEmail,
            avatarImgPath: sender.avatarImgPath,
        },
    ]);
};

/** The request types whose card is composed from locale strings: "<name> wants to join ...". */
const JOIN_TITLE_KEY: Record<number, "joinTeam" | "joinProject" | "joinGm" | "noteAccess"> = {
    [TEAM_REQUEST]: "joinTeam",
    [PROJECT_REQUEST]: "joinProject",
    [GM_REQUEST]: "joinGm",
    [NOTE_ACCESS_REQUEST]: "noteAccess",
};

/** Which sentence a request card says, or null when the card keeps its stored body. */
export const joinTitleKey = (
    itemType: number,
    actor: InboxActor | null
): "joinTeam" | "joinProject" | "joinGm" | "noteAccess" | null =>
    actor && actor.userName !== "" ? (JOIN_TITLE_KEY[itemType] ?? null) : null;

/** Split a template around its `{name}` token so the name can be set bold, in whatever order the
 *  language puts it. */
export const splitAroundName = (template: string): [string, string] => {
    const at = template.indexOf("{name}");
    return at === -1
        ? [template, ""]
        : [template.slice(0, at), template.slice(at + "{name}".length)];
};

/**
 * The name of what a composed join sentence is about, for when the card cannot open it. The
 * stored optionals carry it for rows written recently; older rows only have it in the body's bold
 * run ("... wants to join <b>Name</b> team."). Empty when neither says.
 */
export const fallbackTargetName = (
    item: Pick<InboxItemProps, "itemType" | "itemBody" | "itemOptionals">
): string => {
    const optionals = item.itemOptionals ?? {};
    const key =
        item.itemType === TEAM_REQUEST
            ? "team_name"
            : item.itemType === PROJECT_REQUEST
              ? "project_name"
              : item.itemType === GM_REQUEST
                ? "gm_name"
                : item.itemType === NOTE_ACCESS_REQUEST
                  ? "note_title"
                  : null;
    const named = key ? optionals[key] : undefined;
    if (typeof named === "string" && named !== "") return named;
    if (!Array.isArray(item.itemBody)) return "";
    for (const block of item.itemBody as Block[]) {
        if (!Array.isArray(block?.content)) continue;
        return (block.content as { type?: string; text?: string; styles?: { bold?: boolean } }[])
            .filter((node) => node?.type === "text" && node.styles?.bold === true)
            .map((node) => node.text ?? "")
            .join("");
    }
    return "";
};
