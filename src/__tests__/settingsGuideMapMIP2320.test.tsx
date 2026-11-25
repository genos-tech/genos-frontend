import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SETTINGS_TABS, SettingsModal } from "../components/layout/SettingsModal";
import { en } from "../i18n/locales/en";
import { ALL_GUIDE_IDS, SETTINGS_MAP, type SettingsTabKey } from "../manual/settingsMap";

// Same boundaries as SettingsModalMobileLayout: the panels that fetch on mount are stubbed, so
// what they render is covered by the source scan below, not by the rendered DOM.
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/integrations/services/connections", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../features/integrations/services/connections")>()),
    listConnections: () => Promise.resolve({ connections: [] }),
}));

vi.mock("../features/integrations/services/calendar", () => ({
    listCalendars: () => Promise.resolve([]),
}));
vi.mock("../components/layout/settings/CreditBalance", () => ({
    CreditUsageSection: () => <div />,
}));
vi.mock("../components/layout/settings/PlanUsageSection", () => ({
    PlanUsageSection: () => <div />,
}));
vi.mock("../components/layout/MentionGroupsPanel", () => ({ MentionGroupsPanel: () => <div /> }));
vi.mock("../components/layout/DeveloperSettingsSection", () => ({
    DeveloperSettingsSection: () => null,
}));
vi.mock("../components/layout/TeamEmojiPanel", () => ({ TeamEmojiPanel: () => <div /> }));

const sources = import.meta.glob(["../**/*.{ts,tsx}", "!../__tests__/**", "!../manual/**"], {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

/** Every `guideId="…"` literal the app source declares, by id. */
const declaredInSource = (): Map<string, string[]> => {
    const found = new Map<string, string[]>();
    for (const [file, text] of Object.entries(sources)) {
        for (const match of text.matchAll(/\bguideId="([\w.]+)"/g)) {
            found.set(match[1], [...(found.get(match[1]) ?? []), file]);
        }
    }
    return found;
};

const renderTab = (key: SettingsTabKey) => {
    const view = render(
        <CssVarsProvider>
            <MemoryRouter>
                <SettingsModal initialTab={key} open onClose={vi.fn()} />
            </MemoryRouter>
        </CssVarsProvider>
    );
    const ids = new Set(
        Array.from(document.querySelectorAll("[data-guide-id]")).map(
            (el) => el.getAttribute("data-guide-id") as string
        )
    );
    view.unmount();
    return ids;
};

describe("Settings guide map (MIP-2320)", () => {
    it("has an entry for exactly the tabs the rail registers", () => {
        const registered = SETTINGS_TABS.map((t) => t.key).sort();
        expect(registered).toEqual(Object.keys(SETTINGS_MAP).sort());
    });

    it("labels each tab from an i18n string that exists", () => {
        for (const [key, entry] of Object.entries(SETTINGS_MAP)) {
            const value = entry.labelPath
                .split(".")
                .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
            expect(typeof value, `${key} -> ${entry.labelPath}`).toBe("string");
        }
    });

    // One test per tab: each render is its own 5 s budget instead of all tabs sharing one.
    it.each(SETTINGS_TABS.filter((t) => t.enabled).map((t) => t.key))(
        "renders the %s tab and every rendered guide id is in the map",
        (key) => {
            const ids = renderTab(key);
            expect(ids.has(key), `tab panel ${key} has no data-guide-id`).toBe(true);
            for (const id of ids) {
                expect(ALL_GUIDE_IDS, `rendered id "${id}" has no map entry`).toContain(id);
            }
        }
    );

    it("has a rendered row for every map entry (source scan covers panels stubbed here)", () => {
        const declared = declaredInSource();
        const missing = ALL_GUIDE_IDS.filter((id) => id.includes(".") && !declared.has(id));
        expect(missing, `map entries nothing declares: ${missing.join(", ")}`).toEqual([]);
    });

    it("declares no guideId in the source that the map does not know", () => {
        const unknown = [...declaredInSource().keys()].filter((id) => !ALL_GUIDE_IDS.includes(id));
        expect(unknown, `ids with no map entry: ${unknown.join(", ")}`).toEqual([]);
    });
});
