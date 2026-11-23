import type { InboxItemProps } from "../../../types/common";
import { GM_REQUEST, NOTE_ACCESS_REQUEST, PROJECT_REQUEST, TEAM_REQUEST } from "./inboxItemConfig";

/** The person a card is about: who is asking, or who did the thing. */
export type InboxActor = { userId: string; userName: string };

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
