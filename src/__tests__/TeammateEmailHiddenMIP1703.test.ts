/**
 * A teammate's email is not listed under their name in pickers and search (MIP-1703).
 *
 * In a company of 100+ people the chat search, the editor `@` menu, the Spotlight `@` menu and
 * every member picker listed every colleague's address to everyone. Ken: hide it; whoever wants
 * the address opens the person's profile. Typing an address still FINDS a person (see
 * `personFilterOptions`), it is only not shown.
 *
 * Deliberately NOT in this list, because the address is the subject there, not a label: the
 * profile modal, the invite forms and the pending-invite list, calendar attendees (often
 * outside the team), the owner-transfer picker (irreversible, so the extra line stays), the
 * team/project owner "contact" line, and the connected-apps and API-key lists.
 *
 * A source guard, like `personLabel.test.ts`'s: the surfaces need a socket, a roster and an
 * avatar context each, and what they must not do is one line of JSX.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SURFACES = [
    "src/components/editors/Mention.tsx",
    "src/components/layout/MentionGroupEditor.tsx",
    "src/components/ui/PersonPicker.tsx",
    "src/features/agentQA/mentions/MentionSuggestionDropdown.tsx",
    "src/features/chat/components/modals/ModalAddMembers.tsx",
    "src/features/chat/components/modals/ModalCreateGM.tsx",
    "src/features/chat/components/modals/ModalCreateMDM.tsx",
    "src/features/chat/components/sidebar/ChatSearch.tsx",
    "src/features/notes/common/components/ModalNoteSharing.tsx",
    "src/features/tasks/components/contents/base/CustomFieldsBlock.tsx",
    "src/features/tasks/components/dashboard/TaskHomeContent.tsx",
    "src/features/tasks/components/dashboard/tabs/MemberTasksTab.tsx",
    "src/features/tasks/components/dashboard/useTaskHomeData.ts",
    "src/features/tasks/components/modals/ModalCreateProject.tsx",
    "src/features/tasks/components/table/cellEditors.tsx",
    "src/utils/personLabel.ts",
];

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * Lines that put a person's address on screen: a JSX child, a `subtitle`, a menu row that falls
 * back to it, or a "Name - email" label. Matching on the address (`.includes(q)`, a filter's
 * `stringify`) is allowed and must stay: typing an address still finds the person.
 */
const showsAnEmail = (source: string): string[] =>
    source
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter(
            (line) =>
                /\{\s*[\w.?]*(userEmail|\.email|\bemail)\b[^}]*\}\s*$/.test(line) || // a JSX child
                /subtitle=\{[^}]*(userEmail|email)/.test(line) ||
                /return\s+[\w.]*\bemail\s*\|\|/.test(line) || // `return c.email || "Person"`
                /-\s*\$\{[^}]*(userEmail|\.email)[^}]*\}/.test(line) // `${name} - ${email}`
        );

describe("a teammate's email is not shown in pickers and search", () => {
    for (const rel of SURFACES) {
        it(`${rel} renders no address`, () => {
            expect(showsAnEmail(read(rel))).toEqual([]);
        });
    }

    it("the guard itself sees the shapes it is meant to catch", () => {
        // A guard that cannot fail is worse than none.
        expect(showsAnEmail("    {member.userEmail}")).toHaveLength(1);
        expect(showsAnEmail('    {row.user?.userEmail || ""}')).toHaveLength(1);
        expect(showsAnEmail("    subtitle={user.userEmail}")).toHaveLength(1);
        expect(showsAnEmail("    return c.email || e.mentionPerson;")).toHaveLength(1);
        expect(showsAnEmail("    return `${name} - ${person.userEmail}`;")).toHaveLength(1);
        expect(showsAnEmail("    // {member.userEmail} is not shown")).toHaveLength(0);
    });
});
