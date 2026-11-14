/**
 * The calendar strings of MIP-1059 in all seven locales: the three approval cards
 * (`agentApproval.calendar*`, `calendarFields`), the tool label (`toolNames.get_calendar_event`), the
 * source chip (`spotlight.chip.calendarEvent*`, `entitySubtitle.calendarEvent`) and the event dialog's
 * deleted / failed notice (`calendar.linked`).
 *
 * `DeepPartial<Messages>` lets a locale ship a catalog incrementally and the loader merges every
 * missing key onto English, so a locale that FORGOT a key type-checks, renders, and shows an English
 * sentence in a Japanese card. These read the raw catalogs so the merge cannot hide a gap, then render
 * the real cards and chip in each language.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { sourceChipLabel } from "../features/agentQA/sourceChipLabel";
import type { SpotlightResult } from "../features/spotlight/types";
import { I18nProvider, loadLocale, type Locale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import { LOCALE_STORAGE_KEY } from "../i18n/localeSource";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

const PATHS = [
    "agentApproval.calendarNew",
    "agentApproval.calendarUpdate",
    "agentApproval.calendarUpdateUnnamed",
    "agentApproval.calendarDelete",
    "agentApproval.calendarDeleteUnnamed",
    "agentApproval.calendarAccount",
    "agentApproval.calendarAccountDefault",
    "agentApproval.calendarAccountForeign",
    "agentApproval.calendarUpdateNotFound",
    "agentApproval.calendarDeleteNotFound",
    "agentApproval.calendarEventId",
    "agentApproval.calendarUntitled",
    "agentApproval.calendarTimesIn",
    "agentApproval.calendarNoChange",
    "agentApproval.calendarMeetOn",
    "agentApproval.calendarMeetOff",
    "agentApproval.calendarCalendar",
    "agentApproval.calendarFields.summary",
    "agentApproval.calendarFields.when",
    "agentApproval.calendarFields.location",
    "agentApproval.calendarFields.description",
    "agentApproval.calendarFields.attendees",
    "agentApproval.calendarFields.meet",
    "agentApproval.toolNames.get_calendar_event",
    "spotlight.chip.calendarEvent",
    "spotlight.chip.calendarEventDeleted",
    "spotlight.chip.calendarEventUntitled",
    "spotlight.entitySubtitle.calendarEvent",
    "calendar.linked.title",
    "calendar.linked.deletedTitle",
    "calendar.linked.deletedBody",
    "calendar.linked.failedTitle",
    "calendar.linked.failedBody",
] as const;

/** The same text as English on purpose: a template of slots with no words, and French "Description". */
const SAME_AS_ENGLISH = new Set([
    "spotlight.chip.calendarEvent",
    "fr:agentApproval.calendarFields.description",
]);

const read = (catalog: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (node, key) => (node as Record<string, unknown> | undefined)?.[key],
            catalog
        ) as string | undefined;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the calendar strings have every key in every locale", () => {
    it("English has all of them, filled in", () => {
        for (const path of PATHS) expect(read(en, path)?.trim(), path).toBeTruthy();
    });

    it.each(NAMES)("%s defines every key English has", (name) => {
        const missing = PATHS.filter((p) => !read(OTHERS[name], p));
        expect({ locale: name, missing }).toEqual({ locale: name, missing: [] });
    });

    it.each(NAMES)("%s is translated, not pasted from English", (name) => {
        const untouched = PATHS.filter(
            (p) =>
                !SAME_AS_ENGLISH.has(p) &&
                !SAME_AS_ENGLISH.has(`${name}:${p}`) &&
                read(OTHERS[name], p) === read(en, p)
        );
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the card fills in", (name) => {
        const broken = PATHS.filter((p) => {
            const own = read(OTHERS[name], p);
            return (
                own === undefined ||
                placeholders(own).join() !== placeholders(read(en, p) ?? "").join()
            );
        });
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });
});

const LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];

beforeAll(async () => {
    for (const l of LOCALES) await loadLocale(l);
});
afterEach(() => {
    cleanup();
    localStorage.clear();
});

const FACTS = {
    account_label: "me@work.com",
    account_default: true,
    account_count: 2,
    member_time_zone: "Asia/Tokyo",
};
const CURRENT = {
    summary: "Standup",
    start_iso: "2026-12-01T10:00:00+09:00",
    end_iso: "2026-12-01T10:30:00+09:00",
    all_day: false,
    location: "Room 4",
    attendees: ["ann@x.com"],
    add_meet: false,
};

describe.each(LOCALES)("in %s", (locale) => {
    const card = async (tool: string, args: Record<string, unknown>) => {
        const msgs = await loadLocale(locale);
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        const view = render(
            <CssVarsProvider>
                <I18nProvider>
                    <ApprovalCard
                        approveLabel="APPROVE"
                        rejectLabel="REJECT"
                        titleText="TITLE"
                        pending={{
                            step: 1,
                            tool_name: tool,
                            arguments: args,
                            undoable: false,
                            undo_reason: "irreversible_delete",
                            approval_token: "t",
                            run_id: "r",
                        }}
                        onApprove={() => {}}
                        onReject={() => {}}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        return { msgs, text: view.container.textContent ?? "" };
    };

    it("the create card is in that language", async () => {
        const { msgs, text } = await card("create_calendar_event", {
            ...FACTS,
            summary: "Standup",
            start_iso: "2026-12-01T10:00:00",
            end_iso: "2026-12-01T10:30:00",
            attendees: ["ann@x.com"],
            add_meet: true,
        });
        const a = msgs.agentApproval;
        expect(text).toContain(a.calendarNew);
        expect(text).toContain(a.calendarFields.attendees);
        expect(text).toContain(a.calendarFields.meet);
        expect(text).toContain("me@work.com");
        expect(text).toContain(a.calendarTimesIn.replace("{zone}", "Asia/Tokyo"));
        if (locale !== "en") expect(text).not.toContain("New calendar event");
    });

    it("the update card names the event and the change in that language", async () => {
        const { msgs, text } = await card("update_calendar_event", {
            ...FACTS,
            event_id: "evt1",
            current: CURRENT,
            summary: "Weekly standup",
        });
        const a = msgs.agentApproval;
        expect(text).toContain(a.calendarUpdate.replace("{event}", "Standup"));
        expect(text).toContain(a.calendarFields.summary);
        expect(text).toContain("Weekly standup");
        if (locale !== "en") expect(text).not.toContain("Update calendar event");
    });

    it("the delete card and its not-found state are in that language", async () => {
        const found = await card("delete_calendar_event", {
            ...FACTS,
            event_id: "evt1",
            current: CURRENT,
        });
        expect(found.text).toContain(
            found.msgs.agentApproval.calendarDelete.replace("{event}", "Standup")
        );
        cleanup();
        const missing = await card("delete_calendar_event", {
            ...FACTS,
            event_id: "evt1",
            event_found: false,
        });
        expect(missing.text).toContain(
            missing.msgs.agentApproval.calendarDeleteNotFound.replace("{account}", "me@work.com")
        );
        if (locale !== "en") expect(missing.text).not.toContain("reads as already done");
    });

    it("the chip reads in that language", async () => {
        const msgs = await loadLocale(locale);
        document.documentElement.lang = locale;
        const chip = {
            entity_type: "calendar_event",
            entity_id: "calendar_event:8f5e4733-1a2b-4c3d-8e9f-0123456789ab:abc",
            title: "Standup",
            event_start: "2026-12-01T10:00:00+09:00",
        } as unknown as SpotlightResult;
        const labels = buildAgentTurnLabels(msgs, "spotlight");
        const text = sourceChipLabel(chip, labels);
        expect(text.startsWith(msgs.spotlight.entitySubtitle.calendarEvent)).toBe(true);
        expect(text).toContain("Standup");
        const deleted = sourceChipLabel(
            { ...chip, title: "", event_start: null, operated: true } as SpotlightResult,
            labels
        );
        expect(deleted).toBe(msgs.spotlight.chip.calendarEventDeleted);
        document.documentElement.lang = "";
    });
});
