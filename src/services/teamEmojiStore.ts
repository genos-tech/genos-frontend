import { TeamEmoji } from "./teamEmojiApi";

// Module-singleton catalog of the team's custom emoji.
//
// A React context alone can't serve every consumer: the `:` suggestion
// resolver (`getEmojiSuggestionItems`) is a plain async function called
// by BlockNote outside the component tree, so it needs a synchronous,
// import-time-reachable lookup. React consumers (reaction chips, the
// emoji picker) subscribe via `useSyncExternalStore` so they re-render
// when the catalog lands or changes; `useTeamEmoji` is the single
// writer, mounted once at the App root.

let list: TeamEmoji[] = [];
let byName = new Map<string, TeamEmoji>();
const listeners = new Set<() => void>();

export const getTeamEmojiSnapshot = (): TeamEmoji[] => list;

export const getTeamEmojiByName = (name: string): TeamEmoji | undefined => byName.get(name);

export const setTeamEmojiList = (next: TeamEmoji[]): void => {
    list = next;
    byName = new Map(next.map((e) => [e.name, e]));
    listeners.forEach((cb) => cb());
};

export const subscribeTeamEmoji = (cb: () => void): (() => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};
