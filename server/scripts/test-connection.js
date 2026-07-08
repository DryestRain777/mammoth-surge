/**
 * Verify ShipStation API credentials (read-only).
 *   npm run ss:test
 *
 * Loads server/.env, calls the ShipStation /carriers endpoint, and reports
 * whether the API key/secret are valid. Creates nothing.
 */
const { testConnection } = require("../src/shipstation");

(async () => {
    console.log("→ Testing ShipStation connection…\n");
    const result = await testConnection();
    console.log(JSON.stringify(result, null, 2));

    if (result.ok) {
        const list = result.carriers.length ? result.carriers.join(", ") : "none";
        console.log(`\n✅ Connected. ${result.carriers.length} carrier(s): ${list}`);
        process.exit(0);
    }

    if (!result.configured) {
        console.error(
            "\n⚠️  ShipStation keys are not set.\n" +
                "   1. cp .env.example .env\n" +
                "   2. Paste SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET\n" +
                "      (ShipStation → Settings → Account → API Settings → Generate API Keys)\n" +
                "   3. Re-run:  npm run ss:test"
        );
    } else {
        console.error(
            `\n❌ Connection failed${result.status ? ` (HTTP ${result.status})` : ""}: ${result.error}\n` +
                "   Double-check the API key/secret were copied exactly (no spaces),\n" +
                "   and that API access is enabled on your ShipStation plan."
        );
    }
    process.exit(1);
})();
