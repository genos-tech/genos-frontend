/**
 * The only door to KaTeX and Mermaid. Each loads once, on the first formula or diagram that
 * is drawn, and then comes from the cache: a page with no formula and no diagram never
 * downloads either (MIP-1025). Both modules are imported with `import()` and nowhere else;
 * `LazyRenderersGuard.test.ts` fails the build when something imports them statically.
 */
type KatexModule = typeof import("./katexModule");
type MermaidModule = typeof import("./mermaidModule");

let katexPromise: Promise<KatexModule> | undefined;
let mermaidPromise: Promise<MermaidModule> | undefined;
let katexLoaded: KatexModule | undefined;

export const loadKatex = (): Promise<KatexModule> => {
    katexPromise ??= import("./katexModule").then((module) => {
        katexLoaded = module;
        return module;
    });
    // A failed load (offline, a deploy replaced the chunk) must not stick: try again next time.
    katexPromise.catch(() => {
        katexPromise = undefined;
    });
    return katexPromise;
};

export const loadMermaid = (): Promise<MermaidModule> => {
    mermaidPromise ??= import("./mermaidModule");
    mermaidPromise.catch(() => {
        mermaidPromise = undefined;
    });
    return mermaidPromise;
};

/** KaTeX if it has been loaded already (a synchronous first paint for the second formula). */
export const katexIfLoaded = (): KatexModule | undefined => katexLoaded;
