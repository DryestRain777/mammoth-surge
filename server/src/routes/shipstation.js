/**
 * ShipStation status endpoint.
 * Performs a read-only credential check against the live ShipStation API so you
 * can confirm setup without creating an order.
 *   200 → connected     502 → configured but rejected     503 → not configured
 */
const { testConnection } = require("../shipstation");

async function getShipStationHealth(req, res) {
    const status = await testConnection();
    const code = status.ok ? 200 : status.configured ? 502 : 503;
    res.status(code).json(status);
}

module.exports = { getShipStationHealth };
