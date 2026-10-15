const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createStore } = require("../lib/store");

test("persists quote history across restarts and recovers interrupted PayPal operations", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "guardcart-store-"));
  const filename = path.join(directory, "data", "guardcart.sqlite");
  const now = Date.now();
  const quote = {
    id: "quote-approved",
    items: [{ id: "notebook", name: "Recycled notebook", unitPriceCents: 550, quantity: 1, lineTotalCents: 550, reason: "Test item" }],
    budgetCents: 1000,
    totalCents: 550,
    expiresAt: now + 900000,
    state: "APPROVED",
    paypalOrderId: null,
    captureResult: null,
    approvedAt: now,
    createdAt: now,
    updatedAt: now
  };

  try {
    const firstRun = createStore(filename);
    firstRun.saveQuote(quote);
    firstRun.saveQuote({
      ...quote,
      id: "quote-capturing",
      state: "CAPTURING",
      paypalOrderId: "sandbox-order-123",
      updatedAt: now + 1
    });
    firstRun.saveQuote({ ...quote, id: "quote-creating", state: "CREATING_ORDER" });
    firstRun.close();

    const afterRestart = createStore(filename);
    try {
      assert.equal(afterRestart.getQuote("quote-approved").state, "APPROVED");
      assert.equal(afterRestart.getQuoteByPaypalOrderId("sandbox-order-123").state, "ORDER_CREATED");
      assert.equal(afterRestart.getQuote("quote-creating").state, "APPROVED");
      const history = afterRestart.getOrders();
      assert.equal(history.length, 3);
      assert.equal(history[0].totalCents, 550);
      assert.equal("paypalOrderId" in history[0], false);
    } finally {
      afterRestart.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
