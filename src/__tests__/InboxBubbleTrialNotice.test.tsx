/**
 * InboxBubble: the first-month trial notice (itemType 0, `item_optionals.kind = "core_trial_notice"`,
 * written by genos-api's `first_month_trial_notices`).
 *
 * It is an ordinary activity card, so the only thing that sets it apart is a "Free trial" chip keyed
 * on `kind` (MIP-1772). The plans link in its body is an ABSOLUTE url (`FRONTEND_BASE_URL` + path):
 * a click has to land on the plans page through the app's own routing, not reload or open a tab.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxBubble } from "../features/inbox/components/InboxBubble";
import { UrlLinkModalProvider } from "../hooks/common/UrlLinkModalContext";
import { useUrlLinkModalState } from "../hooks/common/useUrlLinkModalState";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";
import type { InboxItemProps } from "../types/common";

vi.mock("../components/editors/bnChatPreview", () => ({
    BnChatPreview: () => <div data-testid="bn-preview" />,
}));

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const PLANS_URL = `${window.location.origin}/workspace/plans`;

const text = (value: string, styles: Record<string, unknown> = {}) => ({
    type: "text",
    text: value,
    styles,
});

const paragraph = (content: unknown[]) => ({
    type: "paragraph",
    props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
    content,
    children: [],
});

// The body exactly as `compose()` writes it: three paragraphs, then the link.
const trialBody = () => [
    paragraph([text("Your free month of Core ends in 5 days", { bold: true })]),
    paragraph([text("It ends on Dec 1.")]),
    paragraph([text("After that you stay on Free.")]),
    paragraph([
        {
            type: "link",
            href: PLANS_URL,
            content: [text("See the plans", { underline: true })],
        },
    ]),
];

const item = (over: Partial<InboxItemProps> = {}): InboxItemProps => ({
    itemId: 31,
    itemType: 0,
    itemBody: trialBody() as never,
    isRead: true,
    requestStatus: "pending",
    tsSent: "2026-11-20T09:00:00Z",
    itemOptionals: {
        kind: "core_trial_notice",
        stage: "5d",
        ends_at: "2026-12-01T00:00:00Z",
        href: "/workspace/plans",
    },
    ...over,
});

const bubbleProps = {
    myself: { userId: "u1", teamId: "t1" } as never,
    setMyself: vi.fn(),
    socket: null,
    useCM: { allChats: [] } as never,
    useTEM: { teamMemberProfiles: {} } as never,
    useUISM: {} as never,
};

const renderBubble = (inboxItem: InboxItemProps, openModalByHref = vi.fn()) => {
    render(
        <CssVarsProvider>
            <UrlLinkModalProvider value={{ openModalByHref }}>
                <InboxBubble inboxItem={inboxItem} {...bubbleProps} />
            </UrlLinkModalProvider>
        </CssVarsProvider>
    );
    return openModalByHref;
};

const chipLabel = "Free trial";

afterEach(() => vi.restoreAllMocks());

describe("InboxBubble trial notice chip", () => {
    it("shows a 'Free trial' chip on a core_trial_notice card", () => {
        renderBubble(item());
        expect(screen.getByText(chipLabel)).toBeTruthy();
    });

    it("shows it for the 1-day notice too", () => {
        renderBubble(
            item({
                itemOptionals: {
                    kind: "core_trial_notice",
                    stage: "1d",
                    href: "/workspace/plans",
                },
            })
        );
        expect(screen.getByText(chipLabel)).toBeTruthy();
    });

    it("gives no chip to other activity cards (type 0 without that kind)", () => {
        renderBubble(item({ itemOptionals: { project_id: 4, project_name: "Roadmap" } }));
        expect(screen.queryByText(chipLabel)).toBeNull();
    });

    it("gives no chip to a type-0 card with no optionals at all", () => {
        renderBubble(item({ itemOptionals: null as never }));
        expect(screen.queryByText(chipLabel)).toBeNull();
    });

    it("does not leak the chip onto another item type that carries the same kind", () => {
        renderBubble(
            item({
                itemType: 9,
                itemBody: { title: "t", text: "x" } as never,
                itemOptionals: { kind: "core_trial_notice", href: "" },
            })
        );
        expect(screen.queryByText(chipLabel)).toBeNull();
    });

    it("stays an activity: no approve or reject", () => {
        renderBubble(item());
        expect(screen.queryByRole("button", { name: /approve|reject/i })).toBeNull();
    });
});

describe("InboxBubble trial notice plans link", () => {
    it("hands a plain click on the absolute plans link to the URL-link handler, not the browser", () => {
        const open = renderBubble(item());
        const link = screen.getByRole("link", { name: "See the plans" });
        expect(link.getAttribute("href")).toBe(PLANS_URL);
        // `fireEvent.click` returns false when something called preventDefault: the browser's own
        // navigation (a reload) was cancelled.
        const notCancelled = fireEvent.click(link);
        expect(notCancelled).toBe(false);
        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith(PLANS_URL);
    });
});

// The same click through the real handler and a real router: the absolute same-origin url must end
// as a client-side navigation to /workspace/plans (no `window.open`, no reload).
describe("InboxBubble trial notice plans link, through the router", () => {
    const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

    const Harness = () => {
        const navigate = useNavigate();
        const state = useUrlLinkModalState({ navigate });
        return (
            <UrlLinkModalProvider value={state}>
                <InboxBubble inboxItem={item()} {...bubbleProps} />
                <Where />
            </UrlLinkModalProvider>
        );
    };

    it("lands on the plans route without opening a tab", () => {
        const open = vi.spyOn(window, "open").mockImplementation(() => null);
        render(
            <CssVarsProvider>
                <MemoryRouter initialEntries={["/workspace/inbox"]}>
                    <Harness />
                </MemoryRouter>
            </CssVarsProvider>
        );
        expect(screen.getByTestId("where").textContent).toBe("/workspace/inbox");
        fireEvent.click(screen.getByRole("link", { name: "See the plans" }));
        expect(screen.getByTestId("where").textContent).toBe("/workspace/plans");
        expect(open).not.toHaveBeenCalled();
    });
});

// Non-English catalogs are `DeepPartial<Messages>` and fall back to English, so a locale that forgot
// the key type-checks and quietly shows English. These read the raw catalogs. The words are the same as the
// "Free trial" chip on Settings > Plan and usage.
describe("inbox.requestTypes.trialNotice in all seven locales", () => {
    const CATALOGS = { en, ja, es, fr, zh, ar, hi } as const;
    it.each(Object.keys(CATALOGS) as Array<keyof typeof CATALOGS>)(
        "%s has its own label",
        (locale) => {
            const catalog = CATALOGS[locale];
            const label = catalog.inbox?.requestTypes?.trialNotice;
            expect(label).toBeTruthy();
            expect(label).toBe(catalog.settings?.planUsage?.trialChip);
            if (locale !== "en") expect(label).not.toBe(en.inbox.requestTypes.trialNotice);
        }
    );
});
