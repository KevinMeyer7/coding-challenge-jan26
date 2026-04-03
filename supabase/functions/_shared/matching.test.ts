import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calculateMatches } from "./matching.ts";
import type { FruitAttributes, FruitPreferences, ShineFactor } from "./generateFruit.ts";

const baseAttrs: FruitAttributes = {
  size: 7.0, weight: 180, hasStem: true, hasLeaf: false,
  hasWorm: false, shineFactor: "shiny" as ShineFactor, hasChemicals: false,
};

// --- Geometric mean behavior ---

Deno.test("mutual score is 0 when one side scores 0", () => {
  // Apple wants no worm, orange HAS a worm => forward = 0 on that criterion
  const incoming = {
    attributes: baseAttrs,
    preferences: { hasWorm: false } as FruitPreferences,
  };
  const candidates = [{
    id: "orange:1",
    attributes: { ...baseAttrs, hasWorm: true },
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assertEquals(best.mutualScore, 0);
});

Deno.test("mutual score is 1.0 when both sides fully match", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { hasWorm: false } as FruitPreferences,
  };
  const candidates = [{
    id: "orange:1",
    attributes: { ...baseAttrs, hasWorm: false },
    preferences: { hasWorm: false } as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assertEquals(best.mutualScore, 1);
});

Deno.test("geometric mean penalizes imbalance vs arithmetic mean", () => {
  // forward=1.0, reverse=0.5 => geometric=0.71, arithmetic would be 0.75
  const incoming = {
    attributes: { ...baseAttrs, hasStem: true },
    preferences: { hasChemicals: false } as FruitPreferences,
  };
  const candidates = [{
    id: "orange:1",
    attributes: { ...baseAttrs, hasChemicals: false },
    preferences: { hasStem: false } as FruitPreferences, // mismatch
  }];
  const [best] = calculateMatches(incoming, candidates);
  assert(best.mutualScore < 0.75, "geometric mean should be less than arithmetic");
  assert(best.forwardScore === 1.0);
  assertEquals(best.reverseScore, 0);
});

// --- Weighted criteria ---

Deno.test("worm mismatch (3x weight) impacts score more than leaf mismatch (0.7x)", () => {
  const wormMismatch = {
    attributes: baseAttrs,
    preferences: { hasWorm: false, hasLeaf: true } as FruitPreferences,
  };
  const leafOnly = [{
    id: "o:1",
    attributes: { ...baseAttrs, hasWorm: true, hasLeaf: true }, // worm bad, leaf good
    preferences: {} as FruitPreferences,
  }];
  const bothBad = [{
    id: "o:2",
    attributes: { ...baseAttrs, hasWorm: false, hasLeaf: false }, // worm good, leaf bad
    preferences: {} as FruitPreferences,
  }];
  const [wormBad] = calculateMatches(wormMismatch, leafOnly);
  const [leafBad] = calculateMatches(wormMismatch, bothBad);
  // Worm mismatch should produce worse score than leaf mismatch
  assert(wormBad.forwardScore < leafBad.forwardScore,
    `worm miss (${wormBad.forwardScore}) should score lower than leaf miss (${leafBad.forwardScore})`);
});

// --- Numeric range scoring ---

Deno.test("in-range numeric scores 1.0", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { size: { min: 5, max: 10 } } as FruitPreferences,
  };
  const candidates = [{
    id: "o:1",
    attributes: { ...baseAttrs, size: 7.0 },
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assertEquals(best.forwardScore, 1);
});

Deno.test("out-of-range numeric uses exponential decay (not hard cutoff)", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { size: { min: 5, max: 8 } } as FruitPreferences,
  };
  const candidates = [{
    id: "o:1",
    attributes: { ...baseAttrs, size: 8.5 }, // slightly outside
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assert(best.forwardScore > 0, "should not be zero for slight overshoot");
  assert(best.forwardScore < 1, "should not be perfect for out-of-range");
});

// --- Null handling ---

Deno.test("null attribute scores 0.5 (neutral)", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { size: { min: 5, max: 10 } } as FruitPreferences,
  };
  const candidates = [{
    id: "o:1",
    attributes: { ...baseAttrs, size: null },
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assertEquals(best.forwardScore, 0.5);
});

// --- No preferences = accepts anyone ---

Deno.test("fruit with no preferences scores 1.0 (accepts any match)", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: {} as FruitPreferences,
  };
  const candidates = [{
    id: "o:1",
    attributes: { ...baseAttrs, hasWorm: true, shineFactor: "dull" as ShineFactor },
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assertEquals(best.forwardScore, 1);
  assertEquals(best.reverseScore, 1);
  assertEquals(best.mutualScore, 1);
});

// --- Shine factor ordinal scoring ---

Deno.test("shine factor exact match scores 1.0", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { shineFactor: "shiny" } as FruitPreferences,
  };
  const candidates = [{
    id: "o:1",
    attributes: { ...baseAttrs, shineFactor: "shiny" as ShineFactor },
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assertEquals(best.forwardScore, 1);
});

Deno.test("shine factor adjacent value gets partial credit", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { shineFactor: "shiny" } as FruitPreferences,
  };
  const candidates = [{
    id: "o:1",
    attributes: { ...baseAttrs, shineFactor: "extraShiny" as ShineFactor }, // 1 step away
    preferences: {} as FruitPreferences,
  }];
  const [best] = calculateMatches(incoming, candidates);
  assert(best.forwardScore > 0, "adjacent shine should get partial credit");
  assert(best.forwardScore < 1, "adjacent shine should not be perfect");
});

// --- Sorting ---

Deno.test("results are sorted by mutual score descending", () => {
  const incoming = {
    attributes: baseAttrs,
    preferences: { size: { min: 6, max: 8 }, hasWorm: false } as FruitPreferences,
  };
  const candidates = [
    { id: "o:bad", attributes: { ...baseAttrs, size: 2.0, hasWorm: true }, preferences: {} as FruitPreferences },
    { id: "o:good", attributes: { ...baseAttrs, size: 7.0, hasWorm: false }, preferences: {} as FruitPreferences },
    { id: "o:mid", attributes: { ...baseAttrs, size: 10.0, hasWorm: false }, preferences: {} as FruitPreferences },
  ];
  const results = calculateMatches(incoming, candidates);
  assertEquals(results[0].candidateId, "o:good");
  assert(results[0].mutualScore >= results[1].mutualScore);
  assert(results[1].mutualScore >= results[2].mutualScore);
});
