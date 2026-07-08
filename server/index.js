/**
 * Mammoth Surge — backend server
 * Stripe Checkout + ShipStation fulfillment.
 */
const express = require("express");
const cors = require("cors");

const config = require("./src/config");
const { isConfigured } = require("./src/stripe");
const { createCheckoutSession, getOrder } = require("./src/routes/checkout");
const { handleWebhook } = require("./src/routes/webhook");
const { getShipStationHealth } = require("./src/routes/shipstation");

const app = express();
app.set("trust proxy", 1);

// ---------- CORS ----------
function isAllowedOrigin(origin) {
    if (!origin) return true; // same-origin / curl / server-to-server
    if (config.allowedOrigins.includes(origin)) return true;
    try {
        if (new URL(origin).hostname.endsWith(".github.io")) return true;
    } catch (_) {
        /* ignore */
    }
    return false;
}
app.use(
    cors({
        origin(origin, cb) {
            return isAllowedOrigin(origin)
                ? cb(null, true)
                : cb(new Error(`Origin ${origin} not allowed by CORS`));
        },
    })
);

// ---------- Stripe webhook (RAW body, must be before express.json) ----------
app.post("/api/webhook", express.raw({ type: "application/json" }), handleWebhook);

// ---------- JSON for everything else ----------
app.use(express.json());

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        stripe: isConfigured(),
        shipstation: config.shipstationConfigured,
        shipstationBaseUrl: config.shipstation.baseUrl,
        clientUrl: config.clientUrl,
        time: new Date().toISOString(),
    });
});

// Read-only check of the ShipStation credentials against the live API.
app.get("/api/shipstation/health", getShipStationHealth);

app.post("/api/checkout", createCheckoutSession);
app.get("/api/order/:id", getOrder);

app.get("/", (req, res) =>
    res.type("text").send("Mammoth Surge API is running. See /api/health")
);

// ---------- Start ----------
app.listen(config.port, () => {
    console.log(`\n🦣  Mammoth Surge backend → http://localhost:${config.port}`);
    console.log(`    Stripe:      ${isConfigured() ? "✅ configured" : "⚠️  NOT configured (set STRIPE_SECRET_KEY)"}`);
    console.log(`    ShipStation: ${config.shipstationConfigured ? "✅ configured" : "⚠️  NOT configured (set SHIPSTATION_API_KEY/SECRET)"}`);
    console.log(`    Client URL:  ${config.clientUrl}\n`);
});
