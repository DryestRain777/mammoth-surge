/**
 * Product catalog. Prices are in the smallest currency unit (cents).
 * These ids match the `data-plan` attributes on the storefront buttons.
 * Weights (ounces) are used for ShipStation shipping.
 */
const PRODUCTS = {
    single: {
        id: "single",
        name: "Single Surge",
        sku: "MS-CAP-01",
        capsules: 1,
        amount: 800, // $8.00
        weightOz: 2,
    },
    mammoth: {
        id: "mammoth",
        name: "Mammoth Pack",
        sku: "MS-CAP-03",
        capsules: 3,
        amount: 2000, // $20.00
        weightOz: 4,
    },
    beast: {
        id: "beast",
        name: "Beast Mode",
        sku: "MS-CAP-10",
        capsules: 10,
        amount: 5000, // $50.00
        weightOz: 10,
    },
};

module.exports = { PRODUCTS };
