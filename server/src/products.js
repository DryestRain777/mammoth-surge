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
        amount: 1999, // $19.99
        weightOz: 1,
    },
    mammoth: {
        id: "mammoth",
        name: "Mammoth Pack",
        sku: "MS-CAP-06",
        capsules: 6,
        amount: 7999, // $79.99
        weightOz: 4,
    },
    beast: {
        id: "beast",
        name: "Beast Mode",
        sku: "MS-CAP-12",
        capsules: 12,
        amount: 12999, // $129.99
        weightOz: 8,
    },
};

module.exports = { PRODUCTS };
