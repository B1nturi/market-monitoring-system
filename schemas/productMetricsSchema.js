
const mongoose = require('mongoose');

const productMetricsSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',  // Link to the company that owns the product.
        required: true
    },
    productID: {
        type: String,
        ref: 'Product',  // Link to the product that was bought.
        required: true
    },
    toCompany: {
        type: mongoose.Schema.Types.ObjectId,  // Location or source of the product (e.g., supplier, country, etc.)
        ref: 'User',
        required: true
    },
    sellingPrice: {
        type: Number,  // Price the company sells the product for
        required: true
    },
    quantityBought: {
        type: Number,  // How many products the company bought
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// export the schema
module.exports = productMetricsSchema;
