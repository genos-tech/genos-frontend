export type DiffLineKind = "add" | "del" | "meta" | "ctx";

/** A unified-diff line's kind. The `+` / `-` stays in the text, so a change is never colour alone. */
export const diffLineKind = (line: string): DiffLineKind => {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) return "meta";
    if (line.startsWith("+")) return "add";
    if (line.startsWith("-")) return "del";
    return "ctx";
};
