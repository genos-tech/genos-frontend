// The language of a code block, kept to ids the editor's highlighter knows (MIP-1601).
//
// BlockNote's highlighted code block throws "Language X is not supported." while it renders
// the block's language picker when `props.language` is not one of the `supportedLanguages`
// IDS (`typescript`, not its alias `ts`). The throw happens inside the ProseMirror node view,
// so the editor never finishes mounting and the note body does not appear. Language names
// come from outside the editor (a ```ts fence in an imported .md file, an HTML `language-ts`
// paste, a body the API or an agent wrote, a block already stored in a Yjs doc), so every
// entry point resolves them with `resolveCodeLanguage` and the code block spec itself renders
// through it (`genosSchemaParts`).
//
// Pure data and string functions on purpose: it is read by the markdown import, the headless
// Yjs writer and the editors alike.
import { codeBlockOptions } from "@blocknote/code-block";

/** The ids the editor's language picker offers (the highlighter is configured for the same set). */
export const SUPPORTED_CODE_LANGUAGE_IDS: readonly string[] = Object.keys(
    codeBlockOptions.supportedLanguages ?? {}
);

export const PLAIN_TEXT_LANGUAGE = "text";

/**
 * Names that the picker's own alias lists do not carry, each pointing at a supported id. A
 * language the editor has no highlighter for (go, dockerfile, toml, ...) is deliberately NOT
 * here: it resolves to plain text, and adding a highlighter is a bundle-size decision.
 * `codeBlockLanguage.test.ts` fails if a target is not a supported id.
 */
export const EXTRA_CODE_LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
    // JavaScript / TypeScript family
    node: "javascript",
    nodejs: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    javascriptreact: "jsx",
    mts: "typescript",
    cts: "typescript",
    // Shell
    shell: "shellscript",
    console: "shellscript",
    "shell-session": "shellscript",
    shellsession: "shellscript",
    terminal: "shellscript",
    ksh: "shellscript",
    fish: "shellscript",
    // Data / markup
    htm: "html",
    xhtml: "html",
    svg: "xml",
    xsd: "xml",
    xsl: "xml",
    plist: "xml",
    json5: "jsonc",
    ndjson: "jsonl",
    yamlfrontmatter: "yaml",
    mdown: "markdown",
    // Others
    python3: "python",
    py3: "python",
    pyw: "python",
    "c++": "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    h: "c",
    "c-sharp": "csharp",
    golang: "text",
    tex: "latex",
    postgresql: "sql",
    postgres: "sql",
    mysql: "sql",
    sqlite: "sql",
    plsql: "sql",
    // Output, not code
    plaintext: "text",
    plain: "text",
    txt: "text",
    none: "text",
    nohighlight: "text",
    output: "text",
    log: "text",
    diff: "text",
};

const supported = new Set(SUPPORTED_CODE_LANGUAGE_IDS);

const aliasToId = new Map<string, string>();
for (const [id, { aliases }] of Object.entries(codeBlockOptions.supportedLanguages ?? {})) {
    for (const alias of aliases ?? []) aliasToId.set(alias.toLowerCase(), id);
}
for (const [alias, id] of Object.entries(EXTRA_CODE_LANGUAGE_ALIASES)) {
    if (!aliasToId.has(alias)) aliasToId.set(alias, id);
}

/**
 * A language id the editor can render, for whatever name a fence or a block carries. An id
 * passes through, an alias (any case) maps to its id, anything else (including an empty name
 * or a non-string) is plain text. Only the first word counts, so a fence info string such as
 * `ts title="a.ts"` or `js {1,3}` still resolves. Never throws.
 */
export const resolveCodeLanguage = (raw: unknown): string => {
    if (typeof raw !== "string") return PLAIN_TEXT_LANGUAGE;
    const name = raw
        .trim()
        .split(/[\s{]/, 1)[0]
        .toLowerCase()
        .replace(/^\./, "")
        .replace(/^language-/, "");
    if (!name) return PLAIN_TEXT_LANGUAGE;
    if (supported.has(name)) return name;
    return aliasToId.get(name) ?? PLAIN_TEXT_LANGUAGE;
};

type AnyRecord = Record<string, unknown>;

/**
 * `blocks` with every code block (at any depth) set to a language the editor can render. The
 * code itself is not touched, and a block that is already fine is returned as it was, so a
 * caller can compare the result by reference to see whether anything changed.
 */
export const normalizeCodeBlockLanguages = <T>(blocks: T): T => {
    if (!Array.isArray(blocks)) return blocks;
    let changed = false;
    const out = blocks.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const block = raw as AnyRecord;
        let next = block;
        if (block.type === "codeBlock") {
            const props = (block.props ?? {}) as AnyRecord;
            // A block with no `language` prop gets the schema default, which is valid.
            if ("language" in props) {
                const language = resolveCodeLanguage(props.language);
                if (language !== props.language) next = { ...next, props: { ...props, language } };
            }
        }
        if (Array.isArray(block.children) && block.children.length > 0) {
            const children = normalizeCodeBlockLanguages(block.children);
            if (children !== block.children) next = { ...next, children };
        }
        if (next !== block) changed = true;
        return next;
    });
    return (changed ? out : blocks) as T;
};
