/**
 * Stripe client. Initialised lazily so the server can still boot (and report
 * status via /api/health) when keys are not yet configured.
 */
const Stripe = require("stripe");
const config = require("./config");

let stripe = null;
if (config.stripe.secretKey) {
    stripe = new Stripe(config.stripe.secretKey, {
        apiVersion: "2024-06-20",
        appInfo: { name: "Mammoth Surge", version: "1.0.0" },
    });
}

module.exports = {
    stripe,
    isConfigured: () => Boolean(stripe),
};
