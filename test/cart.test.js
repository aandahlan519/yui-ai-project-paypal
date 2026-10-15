const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CATALOG,
  makeDemoRecommendation,
  parseBudget,
  priceCart,
  validatePrompt
} = require("../lib/cart");

test("parses valid dollar budgets into integer cents", () => {
  assert.equal(parseBudget("25.50"), 2550);
  assert.equal(parseBudget(12), 1200);
});

test("rejects malformed, fractional-cent, and excessive budgets", () => {
  for (const budget of ["nope", 0, -1, 1.001, 10001]) {
    assert.throws(() => parseBudget(budget));
  }
});

test("validates prompt length and trims whitespace", () => {
  assert.equal(validatePrompt("  stationery for my desk  "), "stationery for my desk");
  assert.throws(() => validatePrompt("short"));
  assert.throws(() => validatePrompt("a".repeat(501)));
});

test("prices cart only from authoritative catalog values", () => {
  const result = priceCart([{ id: "notebook", quantity: 2, priceCents: 1 }], 2000);
  assert.equal(result.items[0].unitPriceCents, 550);
  assert.equal(result.totalCents, 1100);
});

test("rejects invented, duplicated, invalid, and over-budget cart items", () => {
  assert.throws(() => priceCart([{ id: "invented", quantity: 1 }], 1000));
  assert.throws(() => priceCart([{ id: "notebook", quantity: 1 }, { id: "notebook", quantity: 1 }], 2000));
  assert.throws(() => priceCart([{ id: "notebook", quantity: 0 }], 2000));
  assert.throws(() => priceCart([{ id: "notebook", quantity: 2 }], 1000));
});

test("demo recommendations use catalog IDs and stay inside the budget", () => {
  const recommendation = makeDemoRecommendation("notebook pens for my office", 1800);
  const priced = priceCart(recommendation, 1800);
  assert.ok(recommendation.every(({ id }) => CATALOG.some((product) => product.id === id)));
  assert.ok(priced.totalCents <= 1800);
});
