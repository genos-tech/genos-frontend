import { describe, expect, it } from "vitest";

import {
    announceProjectPrivacyChanged,
    applyProjectPrivacyChange,
    PROJECT_PRIVACY_CHANGED_EVENT,
} from "../services/projectPrivacyChanged";

const list = [
    { projectId: 1, isPrivate: false, isHidden: false },
    { projectId: 2, isPrivate: true, isHidden: false },
];

describe("project privacy change (MIP-1949)", () => {
    it("patches only the changed project in the shared list", () => {
        const next = applyProjectPrivacyChange(list, {
            projectId: 2,
            isPrivate: true,
            isHidden: true,
        });
        expect(next[0]).toBe(list[0]);
        expect(next[1]).toEqual({ projectId: 2, isPrivate: true, isHidden: true });
    });

    it("returns the same array for a project that is not in the list", () => {
        expect(
            applyProjectPrivacyChange(list, { projectId: 9, isPrivate: true, isHidden: false })
        ).toBe(list);
    });

    it("announces the change on window", () => {
        let seen: unknown = null;
        const on = (e: Event) => (seen = (e as CustomEvent).detail);
        window.addEventListener(PROJECT_PRIVACY_CHANGED_EVENT, on);
        announceProjectPrivacyChanged({ projectId: 3, isPrivate: false, isHidden: false });
        window.removeEventListener(PROJECT_PRIVACY_CHANGED_EVENT, on);
        expect(seen).toEqual({ projectId: 3, isPrivate: false, isHidden: false });
    });
});
