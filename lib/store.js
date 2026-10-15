const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function createStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      items_json TEXT NOT NULL,
      budget_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      state TEXT NOT NULL,
      paypal_order_id TEXT UNIQUE,
      capture_result_json TEXT,
      approved_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON quotes(created_at DESC);
  `);

  const insertQuote = database.prepare(`
    INSERT INTO quotes (
      id, items_json, budget_cents, total_cents, expires_at, state,
      paypal_order_id, capture_result_json, approved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateQuote = database.prepare(`
    UPDATE quotes SET
      items_json = ?, budget_cents = ?, total_cents = ?, expires_at = ?, state = ?,
      paypal_order_id = ?, capture_result_json = ?, approved_at = ?,
      created_at = ?, updated_at = ?
    WHERE id = ?
  `);
  const getQuoteById = database.prepare("SELECT * FROM quotes WHERE id = ?");
  const getQuoteByOrderId = database.prepare("SELECT * FROM quotes WHERE paypal_order_id = ?");
  const getOrders = database.prepare(`
    SELECT items_json, budget_cents, total_cents, expires_at, state, created_at, updated_at
    FROM quotes
    ORDER BY created_at DESC
    LIMIT 100
  `);
  const recoverInterrupted = database.prepare(`
    UPDATE quotes
    SET state = CASE state
      WHEN 'CREATING_ORDER' THEN 'APPROVED'
      WHEN 'CAPTURING' THEN 'ORDER_CREATED'
    END,
    updated_at = ?
    WHERE state IN ('CREATING_ORDER', 'CAPTURING')
  `);
  recoverInterrupted.run(Date.now());

  function hydrate(row) {
    if (!row) return null;
    return {
      id: row.id,
      items: JSON.parse(row.items_json),
      budgetCents: row.budget_cents,
      totalCents: row.total_cents,
      expiresAt: row.expires_at,
      state: row.state,
      paypalOrderId: row.paypal_order_id,
      captureResult: row.capture_result_json ? JSON.parse(row.capture_result_json) : null,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  return {
    close() {
      database.close();
    },
    getQuote(id) {
      return hydrate(getQuoteById.get(id));
    },
    getQuoteByPaypalOrderId(orderId) {
      return hydrate(getQuoteByOrderId.get(orderId));
    },
    getOrders() {
      return getOrders.all().map((row) => {
        const quote = hydrate(row);
        return {
          items: quote.items,
          budgetCents: quote.budgetCents,
          totalCents: quote.totalCents,
          expiresAt: quote.expiresAt,
          state: quote.state,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt
        };
      });
    },
    saveQuote(quote) {
      const values = [
        JSON.stringify(quote.items),
        quote.budgetCents,
        quote.totalCents,
        quote.expiresAt,
        quote.state,
        quote.paypalOrderId,
        quote.captureResult ? JSON.stringify(quote.captureResult) : null,
        quote.approvedAt || null,
        quote.createdAt,
        quote.updatedAt
      ];
      if (getQuoteById.get(quote.id)) {
        updateQuote.run(...values, quote.id);
      } else {
        insertQuote.run(quote.id, ...values);
      }
    }
  };
}

module.exports = { createStore };
