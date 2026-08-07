/**
 * The phone / location / local-time / about rows on the profile card.
 *
 * The recurring rule across all four: a field you haven't set renders as
 * a prompt on YOUR card and as nothing at all on anyone else's. An empty
 * labelled row on a colleague's profile is noise — it reports an absence
 * nobody asked about — and on your own it's the affordance.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserProfileAbout } from "../features/admin/components/modals/sub/UserProfileAbout";
import { UserProfileLocalTime } from "../features/admin/components/modals/sub/UserProfileLocalTime";
import { UserProfileLocation } from "../features/admin/components/modals/sub/UserProfileLocation";
import { UserProfilePhone } from "../features/admin/components/modals/sub/UserProfilePhone";
import { updateUserProfile } from "../features/admin/services/updateUserProfile";
import { UserProps } from "../types/admin";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

vi.mock("../features/admin/services/updateUserProfile", () => ({
    updateUserProfile: vi.fn(),
}));

const makeUser = (over: Partial<UserProps> = {}): UserProps => ({
    teamId: "team-1",
    teamName: "Team One",
    userId: "user-1",
    userName: "Alice",
    userEmail: "alice@example.com",
    tsLastSeen: "",
    tsJoined: "",
    avatarImgPath: "",
    ...over,
});

const wrap = (node: React.ReactNode) => render(<CssVarsProvider>{node}</CssVarsProvider>);

const me = makeUser();
const other = makeUser({ userId: "user-2", userName: "Bob" });

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(updateUserProfile).mockResolvedValue({ ok: true });
});

describe("UserProfilePhone", () => {
    it("prompts me to add one when mine is unset", () => {
        wrap(<UserProfilePhone myself={me} setMyself={vi.fn()} user={me} />);
        expect(screen.getByText("Add a phone number")).toBeInTheDocument();
    });

    it("renders nothing for someone else who hasn't set one", () => {
        const { container } = wrap(
            <UserProfilePhone myself={me} setMyself={vi.fn()} user={other} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when the server withheld the field", () => {
        // Guests and cross-team collaborators get roster rows with no
        // `phoneNumber` key at all (`_without_phone` server-side), which
        // must read the same as "not set" rather than as an empty row.
        const guestView = makeUser({ userId: "user-2", userName: "Bob" });
        expect(guestView.phoneNumber).toBeUndefined();
        const { container } = wrap(
            <UserProfilePhone myself={me} setMyself={vi.fn()} user={guestView} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows a colleague's number when they have set one", () => {
        wrap(
            <UserProfilePhone
                myself={me}
                setMyself={vi.fn()}
                user={makeUser({ userId: "user-2", phoneNumber: "+81 90-1234-5678" })}
            />
        );
        expect(screen.getByText("+81 90-1234-5678")).toBeInTheDocument();
    });

    it("is not editable on someone else's profile", async () => {
        const user = userEvent.setup();
        wrap(
            <UserProfilePhone
                myself={me}
                setMyself={vi.fn()}
                user={makeUser({ userId: "user-2", phoneNumber: "+81 90-1234-5678" })}
            />
        );
        await user.click(screen.getByText("+81 90-1234-5678"));
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("saves my own number and mirrors it locally", async () => {
        const user = userEvent.setup();
        const setMyself = vi.fn();
        wrap(<UserProfilePhone myself={me} setMyself={setMyself} user={me} />);

        await user.click(screen.getByText("Add a phone number"));
        await user.type(screen.getByRole("textbox"), "+81 90-1234-5678");
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(updateUserProfile).toHaveBeenCalledTimes(1));
        expect(updateUserProfile).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", phoneNumber: "+81 90-1234-5678" })
        );
        expect(setMyself).toHaveBeenCalledWith(
            expect.objectContaining({ phoneNumber: "+81 90-1234-5678" })
        );
        expect(localStorage.getItem("phoneNumber")).toBe("+81 90-1234-5678");
    });

    it("does not commit locally when the save fails", async () => {
        const user = userEvent.setup();
        vi.mocked(updateUserProfile).mockResolvedValue(undefined);
        const setMyself = vi.fn();
        wrap(<UserProfilePhone myself={me} setMyself={setMyself} user={me} />);

        await user.click(screen.getByText("Add a phone number"));
        await user.type(screen.getByRole("textbox"), "+81 90-1234-5678");
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(updateUserProfile).toHaveBeenCalled());
        expect(setMyself).not.toHaveBeenCalled();
        expect(localStorage.getItem("phoneNumber")).toBeNull();
    });
});

describe("UserProfileLocation", () => {
    it("shows the city rather than the raw zone id", () => {
        wrap(
            <UserProfileLocation
                myself={me}
                setMyself={vi.fn()}
                user={makeUser({ userId: "user-2", currentLocation: "Asia/Tokyo" })}
            />
        );
        expect(screen.getByText("Tokyo")).toBeInTheDocument();
    });

    it("falls back to the raw id for a zone this runtime no longer lists", () => {
        // Truer than "not set" — it is still the best thing we know.
        wrap(
            <UserProfileLocation
                myself={me}
                setMyself={vi.fn()}
                user={makeUser({ userId: "user-2", currentLocation: "Middle/Earth" })}
            />
        );
        expect(screen.getByText("Middle/Earth")).toBeInTheDocument();
    });

    it("renders nothing for someone else who hasn't set one", () => {
        const { container } = wrap(
            <UserProfileLocation myself={me} setMyself={vi.fn()} user={other} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("stores the zone id when I pick a city", async () => {
        const user = userEvent.setup();
        const setMyself = vi.fn();
        wrap(<UserProfileLocation myself={me} setMyself={setMyself} user={me} />);

        await user.click(screen.getByText("Add your location"));
        const input = screen.getByRole("combobox");
        await user.type(input, "Tokyo");
        await user.click(await screen.findByText("Asia · Asia/Tokyo"));

        await waitFor(() => expect(updateUserProfile).toHaveBeenCalledTimes(1));
        expect(updateUserProfile).toHaveBeenCalledWith(
            expect.objectContaining({ currentLocation: "Asia/Tokyo" })
        );
        expect(localStorage.getItem("currentLocation")).toBe("Asia/Tokyo");
    });
});

describe("UserProfileLocalTime", () => {
    it("renders nothing when we know neither zone", () => {
        // Guessing UTC would state a fabrication in the same voice as a
        // fact.
        const { container } = wrap(<UserProfileLocalTime user={other} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("uses the browser-detected zone when no location was picked", () => {
        wrap(<UserProfileLocalTime user={makeUser({ timezone: "Asia/Tokyo" })} />);
        expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it("prefers the picked location over the detected zone", () => {
        // Both set and disagreeing: the clock must follow the one the
        // user chose. Compared against a render of the detected zone
        // alone rather than against a formatted literal, so the test
        // doesn't have to guess the component's locale — Auckland and
        // Honolulu are 22 hours apart and never show the same time.
        const detectedOnly = wrap(
            <UserProfileLocalTime user={makeUser({ timezone: "Pacific/Honolulu" })} />
        );
        const honoluluTime = detectedOnly.container.textContent;
        detectedOnly.unmount();

        const both = wrap(
            <UserProfileLocalTime
                user={makeUser({
                    currentLocation: "Pacific/Auckland",
                    timezone: "Pacific/Honolulu",
                })}
            />
        );
        expect(both.container.textContent).not.toBe(honoluluTime);
    });

    it("says nothing rather than lying when the stored zone is unknown", () => {
        const { container } = wrap(
            <UserProfileLocalTime user={makeUser({ currentLocation: "Middle/Earth" })} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe("UserProfileAbout", () => {
    it("prompts me when mine is empty and stays silent on someone else's", () => {
        const mine = wrap(<UserProfileAbout myself={me} setMyself={vi.fn()} user={me} />);
        expect(screen.getByText("Add a short introduction")).toBeInTheDocument();
        mine.unmount();

        const theirs = wrap(<UserProfileAbout myself={me} setMyself={vi.fn()} user={other} />);
        expect(theirs.container).toBeEmptyDOMElement();
    });

    it("renders a colleague's text as markdown", () => {
        const { container } = wrap(
            <UserProfileAbout
                myself={me}
                setMyself={vi.fn()}
                user={makeUser({ userId: "user-2", aboutMe: "Runs on **coffee**." })}
            />
        );
        expect(container.querySelector("strong")?.textContent).toBe("coffee");
    });

    it("saves my own text trimmed", async () => {
        const user = userEvent.setup();
        const setMyself = vi.fn();
        wrap(<UserProfileAbout myself={me} setMyself={setMyself} user={me} />);

        await user.click(screen.getByText("Add a short introduction"));
        await user.type(screen.getByRole("textbox"), "  Ships things.  ");
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(updateUserProfile).toHaveBeenCalledTimes(1));
        expect(updateUserProfile).toHaveBeenCalledWith(
            expect.objectContaining({ aboutMe: "Ships things." })
        );
    });

    it("blocks the save past the cap instead of letting the server reject it", async () => {
        const user = userEvent.setup();
        wrap(<UserProfileAbout myself={me} setMyself={vi.fn()} user={me} />);

        await user.click(screen.getByText("Add a short introduction"));
        await user.paste("x".repeat(501));

        expect(screen.getByText("501 / 500")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        expect(updateUserProfile).not.toHaveBeenCalled();
    });

    it("is not editable on someone else's profile", async () => {
        const user = userEvent.setup();
        wrap(
            <UserProfileAbout
                myself={me}
                setMyself={vi.fn()}
                user={makeUser({ userId: "user-2", aboutMe: "Ships things." })}
            />
        );
        await user.click(screen.getByText("Ships things."));
        expect(screen.queryByRole("textbox")).toBeNull();
    });
});
