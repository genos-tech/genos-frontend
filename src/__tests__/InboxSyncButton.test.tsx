// The Inbox header's Sync button (MIP-1233): "At least there should be a button
// to load new inbox items." One press = one resync request; a spinner while it
// runs; a short answer as a toast, so the header never changes size.

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { InboxSyncButton } from "../features/inbox/components/InboxSyncButton";
import {
    INBOX_RESYNC_EVENT,
    InboxResyncDetail,
    InboxResyncResult,
} from "../features/inbox/inboxResyncEvent";

type Pending = { detail: InboxResyncDetail; finish: (r: InboxResyncResult) => void };
let asked: Pending[] = [];
let stop = () => {};

beforeEach(() => {
    __resetToasts();
    asked = [];
    const onEvent = (event: Event) => {
        const detail = (event as CustomEvent<InboxResyncDetail>).detail;
        detail.accepted = true;
        asked.push({ detail, finish: (r) => detail.done?.(r) });
    };
    window.addEventListener(INBOX_RESYNC_EVENT, onEvent);
    stop = () => window.removeEventListener(INBOX_RESYNC_EVENT, onEvent);
});
afterEach(() => stop());

const mount = () =>
    rtlRender(
        <CssVarsProvider>
            <InboxSyncButton />
            <ToastHost />
        </CssVarsProvider>
    );

const button = () => screen.getByRole("button", { name: "Sync inbox" });

describe("InboxSyncButton", () => {
    it("is a labelled icon button", () => {
        mount();
        expect(button().textContent).toBe("");
    });

    it("asks for exactly one manual resync per press and spins until it is answered", async () => {
        mount();
        await userEvent.setup().click(button());
        expect(asked).toHaveLength(1);
        expect(asked[0].detail.reason).toBe("manual");

        // Busy and still focusable; a second press cannot stack a request.
        await waitFor(() => expect(button().getAttribute("aria-busy")).toBe("true"));
        expect((button() as HTMLButtonElement).disabled).toBe(false);
        expect(button().querySelector(".MuiCircularProgress-root")).toBeTruthy();
        await userEvent.setup().click(button());
        expect(asked).toHaveLength(1);

        await act(async () => asked[0].finish({ ok: true, added: 0 }));
        await waitFor(() => expect(button().getAttribute("aria-busy")).toBe("false"));
        expect(button().querySelector(".MuiCircularProgress-root")).toBeNull();
        expect(asked).toHaveLength(1);
    });

    it("says up to date when nothing was new", async () => {
        mount();
        await userEvent.setup().click(button());
        await act(async () => asked[0].finish({ ok: true, added: 0 }));
        expect(await screen.findByText("Inbox is up to date")).toBeTruthy();
    });

    it("says how many were new", async () => {
        mount();
        const user = userEvent.setup();
        await user.click(button());
        await act(async () => asked[0].finish({ ok: true, added: 3 }));
        expect(await screen.findByText("3 new items")).toBeTruthy();

        // Pressing again REPLACES the answer instead of stacking a second toast.
        await user.click(button());
        await act(async () => asked[1].finish({ ok: true, added: 1 }));
        expect(await screen.findByText("1 new item")).toBeTruthy();
        expect(screen.queryByText("3 new items")).toBeNull();
    });

    it("says it could not sync, and can be pressed again", async () => {
        mount();
        await userEvent.setup().click(button());
        await act(async () => asked[0].finish({ ok: false, added: 0 }));
        expect(await screen.findByText("Couldn't sync the inbox. Try again.")).toBeTruthy();
        await waitFor(() => expect(button().getAttribute("aria-busy")).toBe("false"));
        // Pressing again works.
        await userEvent.setup().click(button());
        expect(asked).toHaveLength(2);
    });

    it("does not set state after it is gone", async () => {
        const view = mount();
        await userEvent.setup().click(button());
        view.unmount();
        // Resolving after unmount must not throw or warn; the toast still tells.
        await act(async () => asked[0].finish({ ok: true, added: 2 }));
        rtlRender(<ToastHost />);
        expect(await screen.findByText("2 new items")).toBeTruthy();
    });
});
