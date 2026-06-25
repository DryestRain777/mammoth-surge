/**
 * ShipStation integration.
 * Creates (or updates) an order using the classic ShipStation v1 REST API,
 * authenticated with HTTP Basic (API key + secret).
 * Docs: https://www.shipstation.com/docs/api/orders/create-update-order/
 */
const config = require("./config");
const { PRODUCTS } = require("./products");

const SS = config.shipstation;

function authHeader() {
    const token = Buffer.from(`${SS.apiKey}:${SS.apiSecret}`).toString("base64");
    return `Basic ${token}`;
}

function splitName(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { first: parts[0] || "Valued", last: "Customer" };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function mapAddress(name, addr = {}, phone = "") {
    return {
        name: name || "Customer",
        street1: addr.line1 || "",
        street2: addr.line2 || "",
        city: addr.city || "",
        state: addr.state || "",
        postalCode: addr.postal_code || "",
        country: addr.country || "US",
        phone: phone || "",
    };
}

/**
 * Build ShipStation line items from the expanded Stripe line_items.
 * Falls back to the session metadata if line items are unavailable.
 */
function buildItems(session) {
    const lines = (session.line_items && session.line_items.data) || [];
    if (lines.length) {
        return lines.map((li) => {
            const product = li.price && li.price.product;
            const meta = (product && product.metadata) || {};
            return {
                sku: meta.sku || session.metadata?.sku || "MS-CAP",
                name: li.description || (product && product.name) || "Mammoth Surge",
                quantity: li.quantity || 1,
                unitPrice: (li.price?.unit_amount || 0) / 100,
            };
        });
    }
    const plan = PRODUCTS[session.metadata?.plan];
    return [
        {
            sku: session.metadata?.sku || (plan && plan.sku) || "MS-CAP",
            name: plan ? `Mammoth Surge — ${plan.name}` : "Mammoth Surge",
            quantity: 1,
            unitPrice: (session.amount_total || 0) / 100,
        },
    ];
}

/**
 * Create or update a ShipStation order from a completed Stripe Checkout Session.
 * Idempotent: uses the Stripe session id as the orderKey/orderNumber so webhook
 * retries update the same order instead of duplicating it.
 */
async function createShipStationOrder(session) {
    if (!config.shipstationConfigured) {
        console.warn("[shipstation] not configured — skipping order creation");
        return { skipped: true };
    }

    const customer = session.customer_details || {};
    const shipping =
        session.shipping_details ||
        (session.collected_information && session.collected_information.shipping_details) ||
        {};
    const shipName = shipping.name || customer.name || "Customer";
    const shipAddr = shipping.address || customer.address || {};

    const order = {
        orderNumber: session.id,
        orderKey: session.id, // makes the import idempotent
        orderDate: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
        paymentDate: new Date().toISOString(),
        orderStatus: "awaiting_shipment",
        customerEmail: customer.email || "",
        billTo: mapAddress(customer.name || shipName, customer.address || shipAddr, customer.phone),
        shipTo: mapAddress(shipName, shipAddr, customer.phone),
        items: buildItems(session),
        amountPaid: (session.amount_total || 0) / 100,
        shippingAmount: (session.shipping_cost && session.shipping_cost.amount_total ? session.shipping_cost.amount_total : 0) / 100,
        taxAmount: (session.total_details && session.total_details.amount_tax ? session.total_details.amount_tax : 0) / 100,
        paymentMethod: "Stripe",
    };

    if (SS.storeId) {
        order.advancedOptions = { storeId: parseInt(SS.storeId, 10) };
    }

    const resp = await fetch(`${SS.baseUrl}/orders/createorder`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(),
        },
        body: JSON.stringify(order),
    });

    const text = await resp.text();
    if (!resp.ok) {
        throw new Error(`ShipStation ${resp.status}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
}

module.exports = { createShipStationOrder };
