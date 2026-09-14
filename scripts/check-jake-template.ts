// Guards src/templates/jake.ts against unintended edits (human or AI).
//
// jake.ts is meant to stay byte-for-byte identical to the upstream template
// (https://github.com/jakegut/resume/blob/master/resume.tex), with exactly
// one documented exception: \usepackage[T1]{fontenc} + \usepackage[utf8]{inputenc},
// needed because ResumePress renders arbitrary user-entered Unicode (accented
// names, etc.) rather than upstream's hardcoded ASCII sample text. See
// CLAUDE.md's "LaTeX template" section for the full explanation.
//
// This script renders jake.ts with fixed dummy input and diffs it against
// the checked-in golden fixture. Any change to the LaTeX output — intended
// or not — will fail this check, forcing a deliberate decision (and an
// update to both the fixture and CLAUDE.md's discrepancy list) rather than
// letting the template silently drift from upstream.
//
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-jake-template.ts

import { readFileSync } from "fs";
import { join } from "path";
import { render } from "../src/templates/jake";

const dummyIdentity = {
  name: "Test Person",
  email: "test@example.com",
};

const actual = render(dummyIdentity, []).trimEnd();
const goldenPath = join(__dirname, "../src/templates/__fixtures__/jake.golden.tex");
const expected = readFileSync(goldenPath, "utf-8").trimEnd();

if (actual === expected) {
  console.log("OK: jake.ts output matches golden fixture.");
  process.exit(0);
}

console.error("FAIL: jake.ts output has changed from the golden fixture.");
console.error(
  "If this change is intentional, update src/templates/__fixtures__/jake.golden.tex\n" +
    "AND document the new discrepancy from upstream in CLAUDE.md's \"LaTeX template\" section.\n"
);

const actualLines = actual.split("\n");
const expectedLines = expected.split("\n");
const max = Math.max(actualLines.length, expectedLines.length);
for (let i = 0; i < max; i++) {
  if (actualLines[i] !== expectedLines[i]) {
    console.error(`Line ${i + 1}:`);
    console.error(`  expected: ${expectedLines[i] ?? "<missing>"}`);
    console.error(`  actual:   ${actualLines[i] ?? "<missing>"}`);
  }
}
process.exit(1);
