/**
 * Stripe webhook handler.
 * Verifies the signature, and on `checkout.session.completed` creates a
 * ShipStation order for fulfillment.
 *
 * IMPORTANT: this route must receive the RAW request body (see index.js).
 */
const config = require("../config");
const { stripe } = require("../stripe");
const { createShipStationOrder } = require("../shipstation");

async function handleWebhook(req, res) {
    if (!stripe) return res.status(503).send("Stripe not configured");

    let event;
    try {
        if (config.stripe.webhookSecret) {
            const sig = req.headers["stripe-signature"];
            event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
        } else {
            // Dev-only fallback when no signing secret is set. Configure
            // STRIPE_WEBHOOK_SECRET in production for real verification.
            event = JSON.parse(req.body.toString("utf8"));
            console.warn("[webhook] STRIPE_WEBHOOK_SECRET not set — signature NOT verified");
        }
    } catch (err) {
        console.error("[webhook] signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        try {
            // Expand line items (and their products) so we can map SKUs.
            const full = await stripe.checkout.sessions.retrieve(session.id, {
                expand: ["line_items.data.price.product"],
            });
            const result = await createShipStationOrder(full);
            if (result && result.skipped) {
                console.log(`[webhook] paid ${session.id} — ShipStation not configured, fulfillment skipped`);
            } else {
                console.log(`[webhook] ShipStation order created for ${session.id}`);
            }
        } catch (err) {
            console.error("[webhook] fulfillment failed:", err.message);
            // Return 500 so Stripe retries delivery (the import is idempotent).
            return res.status(500).send("Fulfillment failed");
        }
    }

    return res.json({ received: true });
}

module.exports = { handleWebhook };
