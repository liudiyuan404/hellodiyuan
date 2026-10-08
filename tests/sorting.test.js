import assert from "node:assert/strict";
import test from "node:test";
import { GEN } from "../src/sorting.js";
import { LANGS } from "../src/code-samples.js";

const fixtures = [
  [2, 1],
  [1, 2],
  [8, 8],
  [999, 1, 999, 42, 3, 42, 17, 3],
  [12, 22, 11, 21, 12, 11],
  Array.from({ length: 32 }, (_, i) => 32 - i),
  Array.from({ length: 32 }, (_, i) => i + 1),
  Array(32).fill(7),
];
let seed = 17;
for (let run = 0; run < 24; run++) {
  const values = Array.from({ length: 2 + run }, () => {
    seed = (seed * 48271) % 2147483647;
    return 1 + (seed % 999);
  });
  fixtures.push(values);
}

for (const [key, generate] of Object.entries(GEN)) {
  test(`${key}: sorts repeated, ordered, reversed and multi-digit inputs without mutating them`, () => {
    for (const values of fixtures) {
      const original = values.slice();
      let previous = { cmp: 0, swp: 0, wrt: 0 },
        last;
      for (const frame of generate(values)) {
        for (const stat of ["cmp", "swp", "wrt"]) {
          assert.ok(
            Number.isInteger(frame[stat]) && frame[stat] >= previous[stat],
            `${key} ${stat}`,
          );
        }
        previous = frame;
        last = frame;
      }
      assert.ok(last?.fin);
      assert.deepEqual(
        last.a,
        original.toSorted((a, b) => a - b),
      );
      assert.deepEqual(values, original);
    }
  });
}
test("radix matches stable bucket collection: no comparisons or swaps, two writes per element per digit", () => {
  for (const values of fixtures) {
    const frames = [...GEN.radix(values)],
      last = frames.at(-1);
    assert.equal(last.cmp, 0);
    assert.equal(last.swp, 0);
    assert.equal(
      last.wrt,
      2 * values.length * String(Math.max(...values)).length,
    );
  }
});
test("reverse bubble input performs one comparison and swap per inverted pair", () => {
  const input = Array.from({ length: 20 }, (_, i) => 20 - i);
  const last = [...GEN.bubble(input)].at(-1);
  assert.equal(last.cmp, 190);
  assert.equal(last.swp, 190);
  assert.equal(last.wrt, 380);
});
test("every code language maps execution steps to existing source lines", () => {
  for (const [key, languages] of Object.entries(LANGS)) {
    assert.equal(Object.keys(languages).length, 4);
    for (const [lang, pack] of Object.entries(languages)) {
      for (const [step, line] of Object.entries(pack.steps)) {
        assert.ok(
          line >= 1 && line <= pack.code.length,
          `${key}/${lang}/${step}`,
        );
      }
    }
  }
});

test("comparison frames highlight the comparison rather than the swap", () => {
  for (const key of ["bubble", "selection", "shell"]) {
    const comparison = [...GEN[key]([3, 1, 2])].find(
      (frame) => frame.step === "compare",
    );
    assert.ok(comparison, key);
    for (const [language, pack] of Object.entries(LANGS[key])) {
      const line = pack.code[pack.steps.compare - 1];
      assert.match(line, /if.*a\[/, `${key}/${language}: ${line}`);
    }
  }
});
