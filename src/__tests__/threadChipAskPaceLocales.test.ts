/**
 * Strings that were English or word-for-word: the thread chip under a message (MIP-2507), the
 * Pace card (MIP-2489) and "Clear conversation" in the two ask dialogs (MIP-2517).
 */

import { describe, expect, it } from "vitest";

import { fmt } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, zh, es, fr, hi, ar };

describe("the thread chip", () => {
    it("is translated in every locale", () => {
        for (const [locale, messages] of Object.entries(OTHERS)) {
            for (const key of ["comments", "replies"] as const) {
                expect(messages.chat?.underBar?.[key], `${locale}.${key}`).not.toBe(
                    en.chat.underBar[key]
                );
            }
        }
    });

    it("counts in English as before", () => {
        const say = (key: "comments" | "replies", count: number) =>
            fmt(en.chat.underBar[key], { count }, "en");
        expect([say("comments", 1), say("comments", 4)]).toEqual(["1 comment", "4 comments"]);
        expect([say("replies", 1), say("replies", 4)]).toEqual(["1 reply", "4 replies"]);
    });

    it("uses the Arabic plural forms", () => {
        const say = (count: number) => fmt(ar.chat!.underBar!.replies!, { count }, "ar");
        expect([1, 2, 3, 11, 100].map(say)).toEqual([
            "رد واحد",
            "ردّان",
            "3 ردود",
            "11 ردًا",
            "100 رد",
        ]);
    });
});

describe('"Clear conversation"', () => {
    it.each([
        ["ja", ja, "会話を消去"],
        ["zh", zh, "清除对话"],
        ["es", es, "Borrar conversación"],
        ["fr", fr, "Effacer la conversation"],
        ["hi", hi, "बातचीत साफ़ करें"],
        ["ar", ar, "مسح المحادثة"],
    ])("is an action in %s", (_, messages, label) => {
        expect(messages.threadAsk?.conversation?.clear).toBe(label);
        expect(messages.noteAsk?.conversation?.clear).toBe(label);
    });
});

describe("the Pace card", () => {
    it.each([
        ["zh", zh, ["周", "创建", "开始", "关闭"]],
        ["es", es, ["Sem.", "Creadas", "Iniciadas", "Cerradas"]],
        ["fr", fr, ["Sem.", "Créées", "Démarrées", "Fermées"]],
        ["hi", hi, ["सप्ताह", "नए", "शुरू", "बंद"]],
        ["ar", ar, ["أسبوع", "المُنشأة", "المبدوءة", "المغلقة"]],
    ])("has short natural labels in %s", (_, messages, labels) => {
        const v = messages.tasks!.dashboard!.velocity!;
        expect([v.weekPrefix, v.created, v.started, v.closed]).toEqual(labels);
    });
});
