import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserProfileStatus } from "../features/admin/components/modals/sub/UserProfileStatus";
import { updateUserProfile } from "../features/admin/services/updateUserProfile";
import { UserProps } from "../types/admin";

// `useAuth` throws outside an AuthProvider, so stub it. `useTranslation`
// already falls back to the English message tree when no I18nProvider is
// mounted, so it needs no mock here.
vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

// Mock the shared profile-update service so we can assert the payload and
// drive the success / failure branches without a real network call.
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
    customStatus: "",
    avatarImgPath: "",
    isOfflineForced: "false",
    role: "",
    baseCountry: "",
    ...over,
});

const renderStatus = (props: {
    myself: UserProps;
    setMyself: (v: UserProps) => void;
    isYou: boolean;
    user?: UserProps;
}) =>
    render(
        <CssVarsProvider>
            <UserProfileStatus
                isYou={props.isYou}
                myself={props.myself}
                selectedEmoji={null}
                setMyself={props.setMyself}
                setSelectedEmoji={vi.fn()}
                setShowEmojiPicker={vi.fn()}
                user={props.user}
            />
        </CssVarsProvider>
    );

describe("UserProfileStatus — display-name rename (self only)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("renames myself and persists locally on a successful save", async () => {
        const user = userEvent.setup();
        vi.mocked(updateUserProfile).mockResolvedValue({ id: "user-1", username: "Alice Smith" });
        const setMyself = vi.fn();
        const myself = makeUser();

        renderStatus({ myself, setMyself, isYou: true });

        await user.click(screen.getByTestId("EditIcon"));
        const input = screen.getByRole("textbox");
        await user.clear(input);
        await user.type(input, "Alice Smith");
        await user.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(updateUserProfile).toHaveBeenCalledTimes(1));
        // Only the name field is sent (scoped payload) with the caller's id/token.
        expect(updateUserProfile).toHaveBeenCalledWith(
            expect.objectContaining({
                accessToken: "test-token",
                userId: "user-1",
                userName: "Alice Smith",
            })
        );
        expect(setMyself).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user-1", userName: "Alice Smith" })
        );
        expect(localStorage.getItem("userName")).toBe("Alice Smith");
    });

    it("does not render the rename pencil when viewing another user", () => {
        renderStatus({
            myself: makeUser(),
            setMyself: vi.fn(),
            isYou: false,
            user: makeUser({ userId: "user-2", userName: "Bob" }),
        });

        expect(screen.getByText("Bob")).toBeInTheDocument();
        expect(screen.queryByTestId("EditIcon")).toBeNull();
    });

    it("rejects an empty name without calling the API", async () => {
        const user = userEvent.setup();
        const setMyself = vi.fn();

        renderStatus({ myself: makeUser(), setMyself, isYou: true });

        await user.click(screen.getByTestId("EditIcon"));
        await user.clear(screen.getByRole("textbox"));
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText("Name cannot be empty.")).toBeInTheDocument();
        expect(updateUserProfile).not.toHaveBeenCalled();
        expect(setMyself).not.toHaveBeenCalled();
    });

    it("surfaces an error and does not commit when the save fails", async () => {
        const user = userEvent.setup();
        // Service returns undefined on failure (no api / caught error).
        vi.mocked(updateUserProfile).mockResolvedValue(undefined);
        const setMyself = vi.fn();

        renderStatus({ myself: makeUser(), setMyself, isYou: true });

        await user.click(screen.getByTestId("EditIcon"));
        const input = screen.getByRole("textbox");
        await user.clear(input);
        await user.type(input, "New Name");
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText("Couldn't rename. Please try again.")).toBeInTheDocument();
        expect(setMyself).not.toHaveBeenCalled();
        expect(localStorage.getItem("userName")).not.toBe("New Name");
    });
});
