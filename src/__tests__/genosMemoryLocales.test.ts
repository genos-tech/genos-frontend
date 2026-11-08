/**
 * "What Genos remembers" and the Genos rename, across all seven locales.
 *
 * `DeepPartial<Messages>` is what lets a translator ship a catalog
 * incrementally, and the loader merges every missing key onto English. The
 * cost is that a locale which simply FORGOT a key type-checks, renders, and
 * shows an English sentence in the middle of a Japanese settings page. These
 * tests read the raw catalogs (the same way `localeGroupIds.test.ts` does) so
 * the merge can't hide a gap.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

type Tree = { [key: string]: Tree | string };

/** Every leaf as `dotted.path -> string`, however deep. */
const leaves = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, [...trail, k]));
};

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const enMemory = leaves(en.settings.genosMemory, ["settings", "genosMemory"]);
const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;

describe("What Genos remembers has every string in every locale", () => {
    it("has a page worth testing", () => {
        expect(enMemory.length).toBeGreaterThan(50);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].settings?.genosMemory, ["settings", "genosMemory"]).map(
            ([path]) => path
        );
        const wanted = enMemory.map(([path]) => path);
        expect({ locale: name, missing: wanted.filter((p) => !own.includes(p)) }).toEqual({
            locale: name,
            missing: [],
        });
        expect({ locale: name, extra: own.filter((p) => !wanted.includes(p)) }).toEqual({
            locale: name,
            extra: [],
        });
    });

    it.each(NAMES)("%s is translated, not copied from English", (name) => {
        // Short labels may legitimately match (a bare "Genos"), so compare the
        // sentences: anything long enough to be prose must differ.
        const untouched = enMemory
            .filter(([, text]) => text.length > 40)
            .filter(([path, text]) => lookup(OTHERS[name], path) === text)
            .map(([path]) => path);
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the code fills in", (name) => {
        const broken = enMemory
            .filter(([path, text]) => {
                const own = lookup(OTHERS[name], path);
                return own === undefined || placeholders(own).join() !== placeholders(text).join();
            })
            .map(([path]) => path);
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });

    it.each(NAMES)("%s has no empty string", (name) => {
        const empty = leaves(OTHERS[name].settings?.genosMemory)
            .filter(([, text]) => text.trim() === "")
            .map(([path]) => path);
        expect(empty).toEqual([]);
    });
});

describe("the Spotlight -> Genos rename", () => {
    const ALL = { en, ...OTHERS } as const;
    const LOCALES = Object.keys(ALL) as Array<keyof typeof ALL>;

    it.each(LOCALES)("%s names the settings dialog and the tab Genos", (name) => {
        const c = ALL[name];
        expect(c.spotlight?.settings?.title).toContain("Genos");
        expect(c.spotlight?.settings?.openTooltip).toContain("Genos");
        expect(c.settings?.tabs?.spotlight).toBe("Genos");
        // The dialog title / tooltip are no longer the old feature name.
        expect(c.spotlight?.settings?.title).not.toMatch(/Spotlight|スポットライト|स्पॉटलाइट/);
        expect(c.spotlight?.settings?.openTooltip).not.toMatch(
            /Spotlight|スポットライト|स्पॉटलाइट/
        );
    });

    it.each(LOCALES)("%s no longer carries the old daily ask quota in the dialog copy", (name) => {
        const c = ALL[name];
        // Same sentence in the dialog description it used to share with the
        // Spotlight toggles: it must not mention the retired per-day quota.
        expect(c.settings?.spotlight?.heading).toMatch(/Genos/);
        expect(c.settings?.llmModel?.description).toContain("Genos");
        expect(c.settings?.llmModel?.description).not.toMatch(
            /Spotlight|スポットライト|स्पॉटलाइट/
        );
    });

    // The six non-English tooltips used to say "model" where English says
    // "effort" (the picker became an effort picker and these were never
    // updated). Each now has to use that locale's own effort word, the one on
    // the picker the tooltip points at, and not its word for "model".
    const EFFORT_STEM = {
        ja: "Effort",
        es: "esfuerzo",
        fr: "effort",
        zh: "推理强度",
        ar: "جهد",
        hi: "कोशिश",
    } as const;
    const MODEL_STEM = {
        ja: "モデル",
        es: "modelo",
        fr: "modèle",
        zh: "模型",
        ar: "نموذج",
        hi: "मॉडल",
    } as const;

    it("English says effort", () => {
        expect(en.spotlight.settings.openTooltip).toMatch(/effort/i);
    });

    it.each(NAMES)("%s tooltip says effort, as the picker does, and not model", (name) => {
        const tip = OTHERS[name].spotlight?.settings?.openTooltip ?? "";
        const pickerLabel = OTHERS[name].settings?.llmModel?.effortLabel ?? "";
        expect(tip.toLowerCase()).toContain(EFFORT_STEM[name].toLowerCase());
        expect(pickerLabel.toLowerCase()).toContain(EFFORT_STEM[name].toLowerCase());
        expect(tip.toLowerCase()).not.toContain(MODEL_STEM[name].toLowerCase());
    });
});

describe("the orphaned plan capability strings are gone", () => {
    const CAP_KEYS = [
        "capAgencyRead",
        "capAgencyAct",
        "capAgencyOrganize",
        "capDepthQuick",
        "capDepthThorough",
        "capDepthDeep",
        "capDepthAdaptive",
        "capMemoryNone",
        "capMemoryOwn",
        "capMemoryTeam",
        "capGenosHistoryDays",
        "capGenosHistoryUnlimited",
        "capReachWeb",
        "capReachCalendar",
        "capReachGithub",
        "capMcp",
        "capDigestNone",
        "capDigestWeekly",
        "capDigestDaily",
    ];
    const ALL = { en, ...OTHERS } as const;

    it.each(Object.keys(ALL) as Array<keyof typeof ALL>)("%s has none of the 19", (name) => {
        const keys = leaves(ALL[name]).map(([path]) => path.split(".").pop() as string);
        expect(keys.filter((k) => CAP_KEYS.includes(k))).toEqual([]);
    });

    it("the plan matrix still has what the live page reads", () => {
        // Guards the removal against taking a neighbour with it.
        expect(en.settings.planUsage.matrixAgencyRead).toBeTruthy();
        expect(en.settings.planUsage.matrixDepthAdaptive).toBeTruthy();
        expect(en.settings.planUsage.matrixMemoryTeam).toBeTruthy();
    });
});
