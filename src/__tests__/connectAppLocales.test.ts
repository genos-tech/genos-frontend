/**
 * "Connect an AI app" across all seven locales.
 *
 * `localeCatalogCoverage.test.ts` already checks every leaf exists and keeps its
 * placeholders; this adds what it cannot see: the step LISTS keep their length (a step
 * dropped in one language is a different procedure), the address and command are never
 * baked into a catalog (they are built in code from the API origin), the other app's
 * own menu names stay as the app shows them, and the revoke path names the labels this
 * locale's Settings really shows.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { connectApp } from "../i18n/locales/en/connectApp";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, zh, es, fr, hi, ar } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;
const EN = en.settings.connectedApps.connect;
const KEYS = Object.keys(EN) as Array<keyof typeof EN>;

describe("Connect an AI app has every string in every locale", () => {
    it.each(NAMES)("%s defines every key English has, and none it does not", (name) => {
        const own = Object.keys(OTHERS[name].settings?.connectedApps?.connect ?? {});
        expect({ name, missing: KEYS.filter((k) => !own.includes(k)) }).toEqual({
            name,
            missing: [],
        });
        expect({ name, extra: own.filter((k) => !(KEYS as string[]).includes(k)) }).toEqual({
            name,
            extra: [],
        });
    });

    it.each(NAMES)("%s keeps the same number of steps per app", (name) => {
        const own = OTHERS[name].settings?.connectedApps?.connect;
        expect(own?.claudeSteps).toHaveLength(EN.claudeSteps.length);
        expect(own?.claudeCodeSteps).toHaveLength(EN.claudeCodeSteps.length);
    });

    it.each(NAMES)("%s has the pointer line above the key form", (name) => {
        const own = OTHERS[name].settings?.developer?.keys;
        expect(own?.connectPointer?.length).toBeGreaterThan(5);
        expect(own?.connectPointerLink?.length).toBeGreaterThan(5);
    });

    it.each(NAMES)("%s never bakes the address or the command into the catalog", (name) => {
        const text = JSON.stringify(OTHERS[name].settings?.connectedApps?.connect);
        expect(text).not.toMatch(/api\/public|https?:\/\/|claude mcp add/);
    });

    it("English is the one object the public /developers page also prints", () => {
        expect(en.settings.connectedApps.connect).toBe(connectApp);
    });

    it("English does not either", () => {
        expect(JSON.stringify(EN)).not.toMatch(/api\/public|https?:\/\/|claude mcp add/);
    });

    it.each(NAMES)("%s keeps the other app's own menu names in English", (name) => {
        const steps = OTHERS[name].settings?.connectedApps?.connect?.claudeSteps ?? [];
        expect(steps[0]).toContain("Customize");
        expect(steps[0]).toContain("Connectors");
        expect(steps[0]).toContain("Add custom connector");
    });

    it.each(NAMES)("%s: the revoke path uses this locale's own Settings labels", (name) => {
        const cat = OTHERS[name].settings;
        const line = cat?.connectedApps?.connect?.revoke ?? "";
        // Where the member really goes: the Developer tab, then the Connected apps title.
        expect(line).toContain(cat?.tabs?.developer);
        expect(line).toContain(cat?.connectedApps?.title);
    });

    it("English revoke path names the real tab and section", () => {
        expect(EN.revoke).toContain(en.settings.tabs.developer);
        expect(EN.revoke).toContain(en.settings.connectedApps.title);
    });

    it("es and zh name the Developer tab with the word for developers (MIP-1557)", () => {
        // "Revelador" (revealer) and "开发商" (business developer) were machine-translation slips.
        expect(es.settings?.tabs?.developer).toBe("Desarrolladores");
        expect(zh.settings?.tabs?.developer).toBe("开发者");
        for (const [name, bad] of [
            ["es", "Revelador"],
            ["zh", "开发商"],
        ] as const) {
            expect({ name, found: JSON.stringify(OTHERS[name]).includes(bad) }).toEqual({
                name,
                found: false,
            });
        }
    });

    it("es and zh quote the tab by that one name everywhere (no stray singular or synonym)", () => {
        expect(JSON.stringify(es)).not.toMatch(/Desarrollador(?!es)/);
        expect(JSON.stringify(zh)).not.toContain("开发人员");
    });
});

/** "Connect your AI" (MIP-2020): the tabbed page, in all seven locales. */
describe("Connect your AI has every string in every locale", () => {
    const AI = en.settings.connectedApps.connectAi;
    const AI_KEYS = Object.keys(AI) as Array<keyof typeof AI>;
    const own = (name: keyof typeof OTHERS) => OTHERS[name].settings?.connectedApps?.connectAi;

    it.each(NAMES)("%s defines every key English has, and none it does not", (name) => {
        const keys = Object.keys(own(name) ?? {});
        expect({ name, missing: AI_KEYS.filter((k) => !keys.includes(k)) }).toEqual({
            name,
            missing: [],
        });
        expect({ name, extra: keys.filter((k) => !(AI_KEYS as string[]).includes(k)) }).toEqual({
            name,
            extra: [],
        });
    });

    it.each(NAMES)("%s keeps the same number of steps per app", (name) => {
        expect(own(name)?.claudeCodeSteps).toHaveLength(AI.claudeCodeSteps.length);
        expect(own(name)?.claudeDesktopSteps).toHaveLength(AI.claudeDesktopSteps.length);
        expect(own(name)?.chatgptSteps).toHaveLength(AI.chatgptSteps.length);
    });

    it.each(NAMES)(
        "%s ends the Claude Code steps with the /genos:setup command (MIP-2035)",
        (name) => {
            const steps = own(name)?.claudeCodeSteps ?? [];
            expect(steps[steps.length - 1]).toContain("/genos:setup");
            expect(own(name)?.prefWhereClaudeCode).toContain("/genos:setup");
        }
    );

    it("English says install the plugin, sign in, then run /genos:setup", () => {
        expect(AI.claudeCodeSteps).toHaveLength(3);
        expect(AI.claudeCodeSteps[1]).toContain("/mcp");
        expect(AI.claudeCodeSteps[2]).toContain("/genos:setup");
    });

    it.each(NAMES)("%s keeps {days} in the no-activity line and has the link label", (name) => {
        expect(own(name)?.quietLine).toContain("{days");
        expect((own(name)?.quietAction ?? "").length).toBeGreaterThan(0);
    });

    it.each(NAMES)("%s keeps {when} in the activity line", (name) => {
        expect(own(name)?.statusActivity).toContain("{when}");
    });

    it.each(NAMES)("%s never bakes an address or a command into the catalog", (name) => {
        expect(JSON.stringify(own(name))).not.toMatch(/api\/public|https?:\/\/|claude mcp add/);
    });

    it("English does not either", () => {
        expect(JSON.stringify(AI)).not.toMatch(/api\/public|https?:\/\/|claude mcp add/);
    });

    it.each(NAMES)("%s keeps the other app's own menu names in English", (name) => {
        const steps = own(name)?.claudeDesktopSteps ?? [];
        expect(steps[0]).toContain("Customize");
        expect(steps[0]).toContain("Connectors");
        expect(steps[0]).toContain("Add custom connector");
        expect(own(name)?.prefWhereClaudeDesktop).toContain("Settings → Profile");
    });

    it.each(NAMES)("%s names the Core plan on the Free notice", (name) => {
        expect(own(name)?.freePlan).toContain("Core");
    });
});
