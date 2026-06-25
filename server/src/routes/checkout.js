/**
 * Checkout + order lookup handlers.
 */
const config = require("../config");
const { stripe } = require("../stripe");
const { PRODUCTS } = require("../products");

/**
 * POST /api/checkout
 * Body: { plan: "single" | "mammoth" | "beast", quantity?: number }
 * Returns: { id, url }  — redirect the browser to `url`.
 */
async function createCheckoutSession(req, res) {
    if (!stripe) {
        return res.status(503).json({
            error: "Stripe is not configured. Set STRIPE_SECRET_KEY in the server .env file.",
        });
    }

    try {
        const { plan, quantity } = req.body || {};
        const product = PRODUCTS[plan];
        if (!product) {
            return res.status(400).json({ error: `Unknown plan "${plan}".` });
        }
        const qty = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 10);

        const successUrl =
            config.successUrl ||
            `${config.clientUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = config.cancelUrl || `${config.clientUrl}/cancel.html`;

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [
                {
                    quantity: qty,
                    price_data: {
                        currency: config.currency,
                        unit_amount: product.amount,
                        product_data: {
                            name: `Mammoth Surge — ${product.name}`,
                            description: `${product.capsules} capsule${product.capsules > 1 ? "s" : ""} · Premium Male Enhancement`,
                            metadata: { sku: product.sku, plan: product.id },
                        },
                    },
                },
            ],
            shipping_address_collection: { allowed_countries: ["US", "CA"] },
            phone_number_collection: { enabled: true },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: "fixed_amount",
                        fixed_amount: { amount: 0, currency: config.currency },
                        display_name: "Free Discreet Shipping",
                        delivery_estimate: {
                            minimum: { unit: "business_day", value: 3 },
                            maximum: { unit: "business_day", value: 7 },
                        },
                    },
                },
            ],
            allow_promotion_codes: true,
            metadata: {
                plan: product.id,
                sku: product.sku,
                capsules: String(product.capsules * qty),
                weightOz: String(product.weightOz * qty),
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        return res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error("[checkout] error:", err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * GET /api/order/:id
 * Lightweight order summary for the success page.
 */
async function getOrder(req, res) {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured." });
    try {
        const s = await stripe.checkout.sessions.retrieve(req.params.id);
        return res.json({
            status: s.payment_status,
            email: (s.customer_details && s.customer_details.email) || "",
            name: (s.customer_details && s.customer_details.name) || "",
            amountTotal: (s.amount_total || 0) / 100,
            currency: s.currency,
            plan: (s.metadata && s.metadata.plan) || "",
        });
    } catch (err) {
        return res.status(404).json({ error: "Order not found." });
    }
}

module.exports = { createCheckoutSession, getOrder };
