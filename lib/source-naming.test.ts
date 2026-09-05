import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

test("application source filenames use kebab-case", () => {
  for (const root of ["app", "components", "hooks", "lib"]) {
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        expect(entry.name, join(root, entry.name)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.test)?\.tsx?$/);
      }
    }
  }
});
