/**
 * Central configuration, loaded from environment variables.
 * See .env.example for the full list.
 */
require("dotenv").config();

const get = (name, fallback = "") => {
    const v = process.env[name];
    return v === undefined || v === "" ? fallback : v;
};

const config = {
    port: parseInt(get("PORT", "4242"), 10),
    currency: get("CURRENCY", "usd").toLowerCase(),
    clientUrl: get("CLIENT_URL", "http://localhost:5510").replace(/\/$/, ""),
    successUrl: get("SUCCESS_URL", ""),
    cancelUrl: get("CANCEL_URL", ""),

    stripe: {
        secretKey: get("STRIPE_SECRET_KEY"),
        webhookSecret: get("STRIPE_WEBHOOK_SECRET"),
    },

    shipstation: {
        apiKey: get("SHIPSTATION_API_KEY"),
        apiSecret: get("SHIPSTATION_API_SECRET"),
        storeId: get("SHIPSTATION_STORE_ID"),
        orderSource: get("SHIPSTATION_ORDER_SOURCE", "Mammoth Surge Web"),
        baseUrl: get("SHIPSTATION_BASE_URL", "https://ssapi.shipstation.com").replace(/\/$/, ""),
        timeoutMs: parseInt(get("SHIPSTATION_TIMEOUT_MS", "15000"), 10),
    },
};

// Origins allowed to call the API (CORS). *.github.io is also allowed at runtime.
config.allowedOrigins = [
    config.clientUrl,
    "http://localhost:5510",
    "http://127.0.0.1:5510",
];

config.stripeConfigured = Boolean(config.stripe.secretKey);
config.shipstationConfigured = Boolean(config.shipstation.apiKey && config.shipstation.apiSecret);

module.exports = config;
