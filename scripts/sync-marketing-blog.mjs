import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "src/lp/blog/articles.json");
const outputDir = join(root, "src/lp/blog/articles");
const marketingDir = resolve(
    root,
    process.env.GENOS_DOCS_MARKETING_DIR || "../genos-docs/marketing"
);
const checkOnly = process.argv.includes("--check");

const trimOuterRule = (lines) => {
    const result = [...lines];
    while (result[0]?.trim() === "") result.shift();
    if (result[0]?.trim() === "---") result.shift();
    while (result[0]?.trim() === "") result.shift();
    if (result[0]?.startsWith("# ")) result.shift();
    while (result.at(-1)?.trim() === "") result.pop();
    if (result.at(-1)?.trim() === "---") result.pop();
    while (result.at(-1)?.trim() === "") result.pop();
    return result;
};

const extractBody = (source, article) => {
    const start = source.indexOf(article.bodyHeading);
    if (start === -1) {
        throw new Error(`${article.source}: missing body heading "${article.bodyHeading}"`);
    }

    const bodyStart = start + article.bodyHeading.length;
    const stop = article.stopHeading ? source.indexOf(article.stopHeading, bodyStart) : -1;
    const body = source.slice(bodyStart, stop === -1 ? undefined : stop);
    const lines = trimOuterRule(body.replaceAll("\r\n", "\n").split("\n"));

    if (lines.length === 0) {
        throw new Error(`${article.source}: extracted article body is empty`);
    }

    return `<!-- Generated from genos-docs/marketing/${article.source}. Run npm run blog:sync; do not edit this copy directly. -->\n\n${lines.join("\n")}\n`;
};

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const slugs = new Set();
const sources = new Set();

for (const article of manifest) {
    if (article.language !== "en") {
        throw new Error(
            `${article.slug}: LP blog is English-only (got language="${article.language}")`
        );
    }
    if (slugs.has(article.slug)) throw new Error(`Duplicate blog slug: ${article.slug}`);
    if (sources.has(article.source)) throw new Error(`Duplicate blog source: ${article.source}`);
    slugs.add(article.slug);
    sources.add(article.source);
}

await mkdir(outputDir, { recursive: true });
const expectedFiles = new Set();
let changed = 0;

for (const article of manifest) {
    const sourcePath = join(marketingDir, article.source);
    const outputPath = join(outputDir, `${article.slug}.md`);
    const generated = extractBody(await readFile(sourcePath, "utf8"), article);
    expectedFiles.add(`${article.slug}.md`);

    let current = "";
    try {
        current = await readFile(outputPath, "utf8");
    } catch {
        // A new manifest entry has no generated snapshot yet.
    }

    if (current === generated) continue;
    changed += 1;
    if (!checkOnly) await writeFile(outputPath, generated);
}

for (const filename of await readdir(outputDir)) {
    if (!filename.endsWith(".md") || expectedFiles.has(filename)) continue;
    changed += 1;
    if (!checkOnly) await unlink(join(outputDir, filename));
}

if (checkOnly && changed > 0) {
    throw new Error(
        `${changed} generated blog snapshot(s) are stale. Run npm run blog:sync with genos-docs available.`
    );
}

console.log(
    checkOnly
        ? `Blog snapshots are current (${manifest.length} articles).`
        : `Synced ${manifest.length} blog articles (${changed} changed).`
);
