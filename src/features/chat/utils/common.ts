export function getFirstLine(first_line: any): string {
    const first_line_contents: string[] = [];
    try {
        for (const c of first_line["content"]) {
            if (c["type"] === "text") {
                const text = String(c["text"]).trim();
                if (text.length > 0) {
                    first_line_contents.push(text);
                }
            } else if (c["type"] === "mention") {
                first_line_contents.push("@" + c["props"]["userName"]);
            } else if (c["type"] === "link") {
                first_line_contents.push(c["content"][0]["text"]);
            } else {
                console.warn("[WARN] Unexpected content type:", c["type"]);
                console.warn("[WARN] first_line:\n", first_line);
            }
        }
        return first_line_contents.join(" ");
    } catch (e) {
        console.error(e);
        console.error("[ERROR] first_line:", first_line);
        return "Failed to generate the first line...";
    }
}
