const CATALOG = Object.freeze([
  { id: "notebook", name: "Recycled notebook", priceCents: 550, keywords: ["notebook", "paper", "writing", "office", "school"] },
  { id: "pen-set", name: "Smooth-write pen set", priceCents: 425, keywords: ["pen", "writing", "office", "school"] },
  { id: "sticky-notes", name: "Bright sticky notes", priceCents: 375, keywords: ["sticky", "notes", "office", "paper"] },
  { id: "desk-organizer", name: "Bamboo desk organizer", priceCents: 1450, keywords: ["desk", "organizer", "office", "storage"] },
  { id: "water-bottle", name: "Reusable water bottle", priceCents: 1200, keywords: ["water", "bottle", "reusable", "travel"] },
  { id: "usb-cable", name: "Braided USB-C cable", priceCents: 899, keywords: ["usb", "cable", "charging", "tech"] },
  { id: "tote-bag", name: "Everyday canvas tote", priceCents: 950, keywords: ["tote", "bag", "reusable", "travel"] },
  { id: "tea-tin", name: "Herbal tea sampler", priceCents: 1100, keywords: ["tea", "drink", "break", "gift"] },
  { id: "desk-lamp", name: "Compact LED desk lamp", priceCents: 2499, keywords: ["lamp", "light", "desk", "office"] },
  { id: "mouse-pad", name: "Cork mouse pad", priceCents: 725, keywords: ["mouse", "pad", "desk", "office"] }
]);

const MAX_BUDGET_CENTS = 1000000;

function invalidInput(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseBudget(value) {
  const budget = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(budget) || budget <= 0 || budget > MAX_BUDGET_CENTS / 100) {
    throw invalidInput("Budget must be a positive amount no greater than $10,000.");
  }
  const cents = Math.round(budget * 100);
  if (Math.abs(budget * 100 - cents) > 0.000001) {
    throw invalidInput("Budget can have no more than two decimal places.");
  }
  return cents;
}

function validatePrompt(prompt) {
  if (typeof prompt !== "string") {
    throw invalidInput("Tell GuardCart what you need.");
  }
  const normalized = prompt.trim();
  if (normalized.length < 8 || normalized.length > 500) {
    throw invalidInput("Your request must be between 8 and 500 characters.");
  }
  return normalized;
}

function priceCart(items, budgetCents) {
  if (!Array.isArray(items) || items.length === 0 || items.length > CATALOG.length) {
    throw invalidInput("The recommendation must contain between 1 and 10 catalog items.");
  }

  const seen = new Set();
  const pricedItems = items.map((item) => {
    if (!item || typeof item.id !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw invalidInput("Each item must use a catalog ID and a quantity from 1 to 10.");
    }
    if (seen.has(item.id)) {
      throw invalidInput("Each catalog item can only appear once in the cart.");
    }
    seen.add(item.id);
    const product = CATALOG.find((entry) => entry.id === item.id);
    if (!product) {
      throw invalidInput("The recommendation included an item outside the demo catalog.");
    }
    return {
      id: product.id,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
      lineTotalCents: product.priceCents * item.quantity,
      reason: typeof item.reason === "string" ? item.reason.slice(0, 240) : ""
    };
  });

  const totalCents = pricedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  if (totalCents > budgetCents) {
    throw invalidInput("The selected items exceed the budget. Adjust the cart before continuing.");
  }
  return { items: pricedItems, totalCents };
}

function makeDemoRecommendation(prompt, budgetCents) {
  const words = prompt.toLowerCase().match(/[a-z0-9-]+/g) || [];
  const matches = CATALOG.filter((product) =>
    product.keywords.some((keyword) => words.includes(keyword))
  );
  const candidates = matches.length > 0 ? matches : [...CATALOG];
  const chosen = [];
  let remaining = budgetCents;
  for (const product of candidates) {
    if (product.priceCents <= remaining) {
      chosen.push({
        id: product.id,
        quantity: 1,
        reason: matches.length > 0
          ? "Matches a keyword in your request and fits the remaining budget."
          : "A catalog pick that fits the remaining budget."
      });
      remaining -= product.priceCents;
    }
  }
  if (chosen.length === 0) {
    throw invalidInput("The budget is below the price of every matching demo product.");
  }
  return chosen;
}

module.exports = {
  CATALOG,
  MAX_BUDGET_CENTS,
  makeDemoRecommendation,
  parseBudget,
  priceCart,
  validatePrompt
};
