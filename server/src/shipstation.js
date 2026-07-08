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

/**
 * Low-level call to the ShipStation API. Adds auth, a request timeout, and a
 * single automatic retry when ShipStation rate-limits (429) or has a transient
 * 5xx. Returns parsed JSON; throws an Error (with .status) on failure.
 */
async function ssRequest(path, { method = "GET", body } = {}, attempt = 1) {
    if (!config.shipstationConfigured) {
        const err = new Error(
            "ShipStation not configured (set SHIPSTATION_API_KEY / SHIPSTATION_API_SECRET)"
        );
        err.code = "SS_NOT_CONFIGURED";
        throw err;
    }

    let resp;
    try {
        resp = await fetch(`${SS.baseUrl}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: authHeader(),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(SS.timeoutMs || 15000),
        });
    } catch (err) {
        // Network error or timeout — retry once, then give up.
        if (attempt < 2) return ssRequest(path, { method, body }, attempt + 1);
        const e = new Error(`ShipStation request failed: ${err.message}`);
        e.code = "SS_NETWORK";
        throw e;
    }

    // Rate limited / transient server error — honour reset header and retry once.
    if ((resp.status === 429 || resp.status >= 500) && attempt < 2) {
        const reset = Number(resp.headers.get("x-rate-limit-reset")) || 2;
        await new Promise((r) => setTimeout(r, Math.min(reset, 10) * 1000));
        return ssRequest(path, { method, body }, attempt + 1);
    }

    const text = await resp.text();
    if (!resp.ok) {
        const err = new Error(`ShipStation ${resp.status}: ${text || resp.statusText}`);
        err.status = resp.status;
        throw err;
    }
    return text ? JSON.parse(text) : {};
}

/**
 * Verify the API credentials with a lightweight, read-only call (`/carriers`).
 * Never throws — returns a small status object suitable for a health endpoint.
 */
async function testConnection() {
    if (!config.shipstationConfigured) {
        return { ok: false, configured: false, error: "No API key/secret set" };
    }
    try {
        const carriers = await ssRequest("/carriers");
        return {
            ok: true,
            configured: true,
            baseUrl: SS.baseUrl,
            storeId: SS.storeId || null,
            carriers: Array.isArray(carriers) ? carriers.map((c) => c.code) : [],
        };
    } catch (err) {
        return {
            ok: false,
            configured: true,
            status: err.status || null,
            error: err.message,
        };
    }
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
 * Build the ShipStation order payload from a Stripe Checkout Session.
 * Idempotent by design: orderKey/orderNumber = Stripe session id, so webhook
 * retries update the same order instead of creating duplicates.
 */
function buildOrderPayload(session) {
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
        orderSource: SS.orderSource,
        customerUsername: customer.email || "",
        customerEmail: customer.email || "",
        billTo: mapAddress(customer.name || shipName, customer.address || shipAddr, customer.phone),
        shipTo: mapAddress(shipName, shipAddr, customer.phone),
        items: buildItems(session),
        amountPaid: (session.amount_total || 0) / 100,
        shippingAmount: (session.shipping_cost && session.shipping_cost.amount_total ? session.shipping_cost.amount_total : 0) / 100,
        taxAmount: (session.total_details && session.total_details.amount_tax ? session.total_details.amount_tax : 0) / 100,
        paymentMethod: "Stripe",
        gift: false,
        advancedOptions: { source: "Stripe" },
    };

    if (SS.storeId) {
        order.advancedOptions.storeId = parseInt(SS.storeId, 10);
    }
    return order;
}

/**
 * Create (or update) a ShipStation order from a completed Stripe Checkout Session.
 */
async function createShipStationOrder(session) {
    if (!config.shipstationConfigured) {
        console.warn("[shipstation] not configured — skipping order creation");
        return { skipped: true };
    }
    return ssRequest("/orders/createorder", {
        method: "POST",
        body: buildOrderPayload(session),
    });
}

/**
 * A realistic fake Stripe session, used by the test tooling to exercise the
 * full address/SKU mapping without a real purchase.
 */
function sampleSession(overrides = {}) {
    const plan = PRODUCTS.mammoth;
    const address = {
        line1: "1 Tusk Way",
        line2: "Suite 6",
        city: "Austin",
        state: "TX",
        postal_code: "78701",
        country: "US",
    };
    return {
        id: overrides.id || `cs_test_${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        amount_total: plan.amount,
        currency: "usd",
        customer_details: {
            name: "Test Mammoth",
            email: "test@zorvanlabs.com",
            phone: "+15555550123",
            address,
        },
        shipping_details: { name: "Test Mammoth", address },
        shipping_cost: { amount_total: 0 },
        total_details: { amount_tax: 0 },
        metadata: { plan: plan.id, sku: plan.sku, capsules: String(plan.capsules) },
        ...overrides,
    };
}

/** Push a single sample order into ShipStation (for setup verification). */
async function createTestOrder(overrides = {}) {
    return createShipStationOrder(sampleSession(overrides));
}

module.exports = {
    createShipStationOrder,
    buildOrderPayload,
    testConnection,
    sampleSession,
    createTestOrder,
    ssRequest,
};
