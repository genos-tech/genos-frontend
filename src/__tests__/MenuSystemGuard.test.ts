// @vitest-environment node
/**
 * MIP-1128: one menu system. A dropdown or row menu is a `MoreMenu`, or the
 * `MenuSurface` / `MenuRow` parts exported next to it, so every menu shares one
 * surface, row height, danger color, keyboard handling and layer. This guard
 * fails when a file imports Joy's raw `Menu` / `MenuItem` / `MenuList`, or
 * Material's `Menu` / `MenuItem`, instead.
 *
 * `Dropdown` and `MenuButton` (the trigger) stay allowed: a menu with its own
 * trigger still builds its trigger from them. Select and Autocomplete popups are
 * not menus and are not covered.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");
const RAW = new Set(["Menu", "MenuItem", "MenuList"]);

/** Where the raw components are allowed, each with the reason. */
const ALLOWED: Record<string, string> = {
    "components/ui/menu/MenuParts.tsx": "the base itself",
};

const collect = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (entry.name === "__tests__" || entry.name === "node_modules") continue;
            collect(path.join(dir, entry.name), out);
        } else if (/\.tsx?$/.test(entry.name)) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
};

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*["'](@mui\/(?:joy|material))(?:\/[A-Za-z]+)?["']/g;
const DEFAULT_IMPORT =
    /import\s+(Menu|MenuItem|MenuList)\s+from\s*["']@mui\/(?:joy|material)\/\1["']/;

/** Names of raw menu components a source file imports from Joy or Material. */
export const rawMenuImports = (source: string): string[] => {
    const found: string[] = [];
    for (const m of source.matchAll(IMPORT)) {
        for (const part of m[1].split(",")) {
            const name = part
                .trim()
                .split(/\s+as\s+/)[0]
                .replace(/^type\s+/, "");
            if (RAW.has(name)) found.push(name);
        }
    }
    const d = source.match(DEFAULT_IMPORT);
    if (d) found.push(d[1]);
    return found;
};

describe("menu system guard", () => {
    it("no file outside the base imports a raw Joy/Material Menu, MenuItem or MenuList", () => {
        const offenders: string[] = [];
        for (const file of collect(SRC_ROOT)) {
            const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
            if (ALLOWED[rel]) continue;
            const names = rawMenuImports(fs.readFileSync(file, "utf8"));
            if (names.length) offenders.push(`${rel}: ${[...new Set(names)].join(", ")}`);
        }
        expect(
            offenders,
            "Use MoreMenu, or MenuSurface / MenuRow from components/ui/MoreMenu"
        ).toEqual([]);
    });

    it("the detector sees named, aliased, type and subpath imports", () => {
        expect(rawMenuImports('import { Box, Menu } from "@mui/joy";')).toEqual(["Menu"]);
        expect(
            rawMenuImports('import {\n  MenuItem as Item,\n  Box,\n} from "@mui/joy";')
        ).toEqual(["MenuItem"]);
        expect(rawMenuImports('import { Menu, MenuItem } from "@mui/material";')).toEqual([
            "Menu",
            "MenuItem",
        ]);
        expect(rawMenuImports('import Menu from "@mui/material/Menu";')).toEqual(["Menu"]);
        expect(rawMenuImports('import { Menu } from "@mui/joy/Menu";')).toEqual(["Menu"]);
        expect(rawMenuImports('import { Dropdown, MenuButton } from "@mui/joy";')).toEqual([]);
        expect(rawMenuImports('import { Menu } from "@mantine/core";')).toEqual([]);
    });
});
