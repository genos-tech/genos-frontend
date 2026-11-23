/**
 * MIP-2174: a task bar row with no assignee shows nothing, never the "?" placeholder; one with
 * an assignee shows the avatar and the name.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchRowAssignee } from "../features/tasks/components/header/TaskSearchBar";

vi.mock("../features/tasks/components/card", () => ({
    AssigneeAvatar: ({ userId }: { userId: string }) => <i data-testid="avatar">{userId}</i>,
    MilestoneFlag: () => null,
    TaskIdText: () => null,
}));

describe("SearchRowAssignee", () => {
    it("renders nothing when unassigned", () => {
        const { container } = render(<SearchRowAssignee assigneeId={null} assigneeName={null} />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByText("?")).toBeNull();
    });

    it("shows the avatar and name when assigned", () => {
        render(<SearchRowAssignee assigneeId="u1" assigneeName="Ann" />);
        expect(screen.getByTestId("avatar")).toHaveTextContent("u1");
        expect(screen.getByText("Ann")).toBeInTheDocument();
    });
});
