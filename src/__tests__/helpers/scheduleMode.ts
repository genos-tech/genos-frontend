import { screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

/** The Mode dropdown of an AI job in the Schedules form (MIP-2349). */
export const modeBox = (): HTMLElement =>
    within(screen.getByTestId("schedule-params")).getByRole("combobox", { name: "Mode" });

export const queryModeBox = (): HTMLElement | null =>
    within(screen.getByTestId("schedule-form")).queryByRole("combobox", { name: "Mode" });

/** Open the dropdown and choose a mode, as a member does. */
export const chooseMode = async (
    user: ReturnType<typeof userEvent.setup>,
    mode: "plain" | "ai"
): Promise<void> => {
    await user.click(modeBox());
    await user.click(
        await screen.findByRole("option", {
            name: mode === "ai" ? "Scheduled job by Genos AI" : "Scheduled job",
        })
    );
};
