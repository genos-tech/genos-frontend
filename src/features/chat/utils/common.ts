export function getFirstLine(first_line: any): string {
    if (!first_line || typeof first_line !== "object") return "";
    const blockType: string | undefined = first_line.type;

    if (blockType === "image") {
        const name = first_line?.props?.name;
        return name ? `Image: ${name}` : "Image";
    }

    if (blockType === "file") {
        const name = first_line?.props?.name;
        return name ? `File: ${name}` : "File";
    }

    if (blockType === "table") {
        return "Table";
    }

    if (blockType === "divider") {
        return "";
    }

    // Content-bearing blocks (paragraph, heading, list items, quote,
    // codeBlock, ...) carry an inline-content array. Unknown block
    // types fall through here too — if they happen to have a content
    // array we still extract something useful; otherwise the loop is
    // a no-op and we return "".
    const parts: string[] = [];
    for (const c of (first_line.content as unknown[]) ?? []) {
        if (!c || typeof c !== "object") continue;
        const inline = c as { type?: string; text?: unknown; props?: any; content?: any };
        if (inline.type === "text") {
            const text = String(inline.text ?? "").trim();
            if (text) parts.push(text);
        } else if (inline.type === "mention") {
            const user = inline.props?.userName;
            if (user) parts.push(`@${user}`);
        } else if (inline.type === "mentionGroup") {
            const group = inline.props?.groupName;
            if (group) parts.push(`@${group}`);
        } else if (inline.type === "link") {
            const inner = (inline.content as { text?: string }[]) ?? [];
            if (inner[0]?.text) parts.push(inner[0].text);
        }
        // Unknown inline types are skipped silently — forward-
        // compatibility, not a bug to warn about.
    }

    const joined = parts.join(" ");
    if (joined) return joined;

    // Last-resort label for content-bearing blocks that turned out to
    // be empty (e.g. an empty code block).
    if (blockType === "codeBlock") return "Code";
    return "";
}
