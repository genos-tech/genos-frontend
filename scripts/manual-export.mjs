// Builds src/manual/manual.<lang>.json (en, ja) from src/manual/<lang>/*.md and the settings map
// (MIP-2321, MIP-2322). The first language (en) is the reference the others are checked against.
//
//   npm run manual:export          write the JSON
//   npm run manual:check           fail (exit 1) when the committed JSON is out of date
//
// The builder is TypeScript (it reads the settings map and the app's i18n strings), so it is
// loaded through Vite's SSR loader instead of being copied here.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manualDir = join(root, "src", "manual");
const check = process.argv.includes("--check");
const LANGUAGES = ["en", "ja"];

const server = await createServer({
    root,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
});

let failed = false;
try {
    const { buildManual, checkManual, checkParity } = await server.ssrLoadModule(
        "/src/manual/manualSource.ts"
    );
    let reference = null;
    for (const lang of LANGUAGES) {
        const dir = join(manualDir, lang);
        const files = {};
        for (const name of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
            files[name] = readFileSync(join(dir, name), "utf8");
        }
        const manual = buildManual(lang, files);
        if (!reference) reference = manual;
        const problems = [
            ...checkManual(manual),
            ...(manual === reference ? [] : checkParity(manual, reference)),
        ];
        if (problems.length) {
            console.error(`manual.${lang}: ${problems.join("\n  ")}`);
            failed = true;
            continue;
        }
        const target = join(manualDir, `manual.${lang}.json`);
        const config = (await resolveConfig(target)) ?? {};
        const text = await format(JSON.stringify(manual), { ...config, filepath: target });
        if (check) {
            const current = existsSync(target) ? readFileSync(target, "utf8") : "";
            if (current !== text) {
                console.error(`manual.${lang}.json is out of date: run \`npm run manual:export\``);
                failed = true;
            }
        } else {
            writeFileSync(target, text);
            console.log(`wrote src/manual/manual.${lang}.json (${manual.topics.length} topics)`);
        }
    }
} finally {
    await server.close();
}
process.exit(failed ? 1 : 0);
