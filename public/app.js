const state = {
  config: null,
  recommendation: null,
  quote: null,
  busy: false
};

const elements = {
  form: document.querySelector("#request-form"),
  prompt: document.querySelector("#prompt"),
  budget: document.querySelector("#budget"),
  notice: document.querySelector("#notice"),
  recommendButton: document.querySelector("#recommend-button"),
  cartPanel: document.querySelector("#cart-panel"),
  cartItems: document.querySelector("#cart-items"),
  cartMode: document.querySelector("#cart-mode"),
  cartTotal: document.querySelector("#cart-total"),
  cartNotice: document.querySelector("#cart-notice"),
  quoteActions: document.querySelector("#quote-actions"),
  prepareQuote: document.querySelector("#prepare-quote"),
  approvalPanel: document.querySelector("#approval-panel"),
  approveQuote: document.querySelector("#approve-quote"),
  paypalPanel: document.querySelector("#paypal-panel"),
  paypalButtons: document.querySelector("#paypal-buttons"),
  retryPaypal: document.querySelector("#retry-paypal"),
  refreshOrders: document.querySelector("#refresh-orders"),
  orderList: document.querySelector("#order-list"),
  historyEmpty: document.querySelector("#history-empty")
};

function dollars(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function setNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", isError);
  elements.notice.hidden = !message;
}

function setBusy(button, isBusy, label) {
  button.disabled = isBusy;
  if (label) {
    button.dataset.originalText ||= button.textContent;
    button.textContent = isBusy ? label : button.dataset.originalText;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request could not be completed.");
  }
  return data;
}

function clearQuote() {
  state.quote = null;
  elements.quoteActions.hidden = false;
  elements.approvalPanel.hidden = true;
  elements.paypalPanel.hidden = true;
  elements.retryPaypal.hidden = true;
  elements.paypalButtons.replaceChildren();
}

function renderCart(recommendation) {
  state.recommendation = recommendation;
  clearQuote();
  elements.cartItems.replaceChildren();
  for (const item of recommendation.items) {
    const row = document.createElement("article");
    row.className = "cart-item";
    const description = document.createElement("div");
    const name = document.createElement("p");
    name.className = "item-name";
    name.textContent = `${item.quantity} × ${item.name}`;
    const reason = document.createElement("p");
    reason.className = "item-reason";
    reason.textContent = item.reason || "Selected from the demo catalog.";
    const price = document.createElement("span");
    price.className = "item-price";
    price.textContent = dollars(item.lineTotalCents);
    description.append(name, reason);
    row.append(description, price);
    elements.cartItems.append(row);
  }
  elements.cartMode.textContent = recommendation.mode === "ai" ? "AI RECOMMENDATION" : "LOCAL DEMO MODE";
  elements.cartTotal.textContent = dollars(recommendation.totalCents);
  elements.cartNotice.textContent = `${recommendation.notice} Budget: ${dollars(recommendation.budgetCents)}. Shipping and taxes are not included.`;
  elements.cartPanel.hidden = false;
  elements.cartPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderOrders(orders) {
  elements.orderList.replaceChildren();
  elements.historyEmpty.hidden = orders.length > 0;
  for (const order of orders) {
    const card = document.createElement("article");
    card.className = "order-card";
    const heading = document.createElement("div");
    heading.className = "order-card-heading";
    const status = document.createElement("span");
    status.className = "order-status";
    status.textContent = order.state.replaceAll("_", " ");
    const total = document.createElement("span");
    total.className = "order-total";
    total.textContent = dollars(order.totalCents);
    heading.append(status, total);
    const date = document.createElement("p");
    date.className = "order-meta";
    date.textContent = new Date(order.createdAt).toLocaleString();
    const items = document.createElement("p");
    items.className = "order-items";
    items.textContent = order.items.map((item) => `${item.quantity} × ${item.name}`).join(" · ");
    card.append(heading, date, items);
    elements.orderList.append(card);
  }
}

async function refreshOrders() {
  try {
    const result = await api("/api/orders");
    renderOrders(result.orders);
  } catch (error) {
    setNotice(`Could not load saved order history: ${error.message}`, true);
  }
}

async function loadPaypalSdk() {
  if (!state.config.paypalClientId) {
    throw new Error("PayPal Sandbox is not configured. Add your sandbox client ID and secret to .env.");
  }
  if (window.paypal) {
    return window.paypal;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(state.config.paypalClientId)}&currency=USD&intent=capture`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load the PayPal Sandbox checkout. Check your connection and sandbox client ID."));
    document.head.append(script);
  });
  if (!window.paypal) {
    throw new Error("PayPal checkout did not initialize.");
  }
  return window.paypal;
}

async function showPaypalButtons() {
  elements.retryPaypal.hidden = true;
  elements.paypalButtons.replaceChildren();
  try {
    const paypal = await loadPaypalSdk();
    await paypal.Buttons({
      createOrder: async () => {
        const result = await api("/api/paypal/orders", {
          method: "POST",
          body: JSON.stringify({ quoteId: state.quote.id })
        });
        return result.id;
      },
      onApprove: async (data) => {
        setNotice("Confirming your PayPal Sandbox payment…");
        const result = await api("/api/paypal/capture", {
          method: "POST",
          body: JSON.stringify({ quoteId: state.quote.id, orderId: data.orderID })
        });
        if (result.status !== "COMPLETED") {
          throw new Error("PayPal did not confirm a completed payment.");
        }
        setNotice(`Payment completed in PayPal Sandbox. Approved total: ${dollars(result.totalCents)}.`);
        elements.paypalButtons.replaceChildren();
        await refreshOrders();
      },
      onCancel: () => setNotice("Checkout was cancelled. Your approved cart remains available until its quote expires."),
      onError: (error) => {
        console.error("PayPal checkout error:", error);
        elements.retryPaypal.hidden = false;
        setNotice(error.message || "PayPal checkout could not be completed. Your cart has not been marked as paid.", true);
      }
    }).render(elements.paypalButtons);
  } catch (error) {
    elements.retryPaypal.hidden = false;
    throw error;
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  setNotice("");
  setBusy(elements.recommendButton, true, "Preparing…");
  try {
    const result = await api("/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ prompt: elements.prompt.value, budget: elements.budget.value })
    });
    renderCart(result);
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    state.busy = false;
    setBusy(elements.recommendButton, false);
  }
});

elements.prepareQuote.addEventListener("click", async () => {
  if (!state.recommendation || state.busy) return;
  state.busy = true;
  setNotice("");
  setBusy(elements.prepareQuote, true, "Locking…");
  try {
    const quote = await api("/api/quotes", {
      method: "POST",
      body: JSON.stringify({
        items: state.recommendation.items.map(({ id, quantity }) => ({ id, quantity })),
        budget: (state.recommendation.budgetCents / 100).toFixed(2)
      })
    });
    state.quote = quote;
    await refreshOrders();
    elements.quoteActions.hidden = true;
    elements.approvalPanel.hidden = false;
    elements.cartNotice.textContent = `Server-verified total: ${dollars(quote.totalCents)}. This exact quote expires in 15 minutes.`;
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    state.busy = false;
    setBusy(elements.prepareQuote, false);
  }
});

elements.approveQuote.addEventListener("click", async () => {
  if (!state.quote || state.busy) return;
  state.busy = true;
  setNotice("");
  setBusy(elements.approveQuote, true, "Recording approval…");
  try {
    await api(`/api/quotes/${state.quote.id}/approve`, { method: "POST", body: "{}" });
    await refreshOrders();
    elements.approvalPanel.hidden = true;
    elements.paypalPanel.hidden = false;
    await showPaypalButtons();
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    state.busy = false;
    setBusy(elements.approveQuote, false);
  }
});

elements.retryPaypal.addEventListener("click", async () => {
  if (!state.quote || state.busy) return;
  state.busy = true;
  setNotice("");
  setBusy(elements.retryPaypal, true, "Loading PayPal…");
  try {
    await showPaypalButtons();
  } catch (error) {
    setNotice(error.message, true);
  } finally {
    state.busy = false;
    setBusy(elements.retryPaypal, false);
  }
});

elements.refreshOrders.addEventListener("click", refreshOrders);

async function initialize() {
  try {
    state.config = await api("/api/config");
    if (!state.config.paypalClientId) {
      setNotice("PayPal Sandbox credentials are not set yet. Recommendations work locally; add sandbox credentials to enable checkout.");
    }
    if (!state.config.aiConfigured) {
      elements.cartNotice.textContent = "AI is not configured, so recommendations use the labeled local demo mode.";
    }
    await refreshOrders();
  } catch (error) {
    setNotice(`Could not initialize GuardCart: ${error.message}`, true);
  }
}

initialize();
