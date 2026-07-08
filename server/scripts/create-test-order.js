/**
 * Push ONE sample order into ShipStation to verify the full mapping.
 *   npm run ss:order
 *
 * Uses a realistic fake Stripe session (no real charge). Open ShipStation →
 * Orders → Awaiting Shipment to see it, then delete the test order.
 */
const {
    createTestOrder,
    buildOrderPayload,
    sampleSession,
} = require("../src/shipstation");

(async () => {
    const preview = buildOrderPayload(sampleSession());
    console.log("→ Creating a TEST order in ShipStation:\n");
    console.log(
        JSON.stringify(
            { orderNumber: preview.orderNumber, shipTo: preview.shipTo, items: preview.items },
            null,
            2
        )
    );

    try {
        const res = await createTestOrder();
        if (res && res.skipped) {
            console.error(
                "\n⚠️  ShipStation not configured — set your keys in server/.env first " +
                    "(then run `npm run ss:test`)."
            );
            process.exit(1);
        }
        console.log(
            `\n✅ Order created.  orderId: ${res.orderId}   orderKey: ${res.orderKey}`
        );
        console.log("   Open ShipStation → Orders → Awaiting Shipment to see it.");
        console.log("   Re-running this reuses the same orderKey (no duplicates).");
        console.log("   👉 Delete the test order in ShipStation when you're done.");
        process.exit(0);
    } catch (err) {
        console.error(`\n❌ Failed to create test order: ${err.message}`);
        console.error("   Run `npm run ss:test` first to check your credentials.");
        process.exit(1);
    }
})();
