# GuardCart

GuardCart is a consent-first AI shopping agent demo. It recommends items from a small synthetic catalog, verifies the cart and budget on the server, then requires two explicit user actions: locking the quote and approving it before a PayPal Sandbox checkout can start.

## What is protected

- The model returns catalog IDs and quantities only; the server looks up every product name and price in its own catalog.
- The server recomputes each line total and refuses invalid items or carts above the user's budget.
- The cart is frozen in a short-lived, server-side quote. PayPal receives its amount from the server, never from browser-supplied prices.
- The PayPal order cannot be created until the quote is explicitly approved. Capture is tied back to the PayPal order and approved quote.
- Payment credentials stay on the server. No real-money or simulated payment path is included.

The current demo uses a small synthetic catalog and a local SQLite database (`data/guardcart.sqlite`) for quotes and order history, so records survive server restarts. Catalog prices are synthetic USD demo prices; shipping and taxes are not included. The server binds to `127.0.0.1` by default. Do not expose the app publicly without authentication and request abuse protection, or use this prototype for real purchases.

## Requirements

- Node.js 22.13 or newer (includes the built-in `node:sqlite` module)
- A PayPal Developer account and Sandbox REST app for checkout
- Optionally, an OpenAI-compatible Chat Completions API key and model for live AI recommendations

## Run locally

1. Copy `.env.example` to `.env`.
2. Fill in `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` with **Sandbox** credentials to enable PayPal checkout.
3. Optionally set `AI_API_KEY` and `AI_MODEL`. If no AI key is configured, the app clearly labels its deterministic local recommender as demo mode. If AI is enabled but unavailable or malformed, the app reports an error instead of silently falling back. Shopping requests are sent to the configured AI provider when live AI is enabled; do not enter sensitive information.
4. Start the app with `npm start`, then open [http://localhost:3000](http://localhost:3000).

`npm start` loads values from `.env` if the file exists. Environment variables already set by the shell or process manager take precedence.

Never commit `.env` or expose the PayPal client secret or AI API key in client-side code. The browser receives only the PayPal Sandbox client ID.
The SQLite database is stored in `data/guardcart.sqlite`. Set `DATA_DIR` to a persistent writable directory if you host the app. Set `HOST=0.0.0.0` only when a hosting platform requires it; public deployments need authentication and abuse protection first.

## Test

Run `npm test` to execute the server-side catalog, budget, and cart validation tests.

## Demo flow

1. Describe a shopping need and set a budget.
2. Review the recommendation, its reasons, and the server-recomputed total.
3. Lock the cart to create a time-limited quote.
4. Explicitly approve that exact quote.
5. Continue with PayPal Sandbox checkout and verify the Sandbox transaction.

## PayPal Sandbox setup

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) with your PayPal account and select the **Sandbox** environment.
2. In **Apps & Credentials**, open the Sandbox tab and copy the Client ID and Secret from the Default Application, or create a dedicated app.
3. Put them in the server-side `.env` file as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. The Client ID is used by the browser's PayPal SDK; keep the Secret server-side.
4. In **Testing Tools → Sandbox Accounts**, use the generated **Personal** account to approve checkout. The generated **Business** account is the seller; inspect its activity to verify the captured test payment.
5. Use only Sandbox values and `https://api-m.sandbox.paypal.com` for this demo. Never use Live credentials here.

The order history is local to this server and displays the 100 most recent quote records. It shows preparation, approval, and payment states. Interrupted order creation/capture operations are made retryable on startup and use stable PayPal request IDs to reduce duplicate processing.

The server logs PayPal's `debug_id` and issue codes for failures without returning raw provider error messages to the browser. A Sandbox capture declined with `INSTRUMENT_DECLINED` produces a retry-oriented user message.

## Limitations and next hardening steps

- The SQLite store is for a single-process demo. A multi-instance deployment needs shared durable storage and stronger customer/session binding.
- Add request rate limiting and abuse protection before public deployment.
- Configure the AI endpoint and model according to the selected provider's API and terms.
- Production commerce would need authoritative inventory, taxes, shipping, refunds, and operational support.

## License

MIT. See [LICENSE](./LICENSE).
