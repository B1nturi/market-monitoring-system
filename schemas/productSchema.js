
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productID: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    batchNumber: {
        type: String,
        required: true
    },
    manufacturer: {
        type: String, 
        required: true
    },
    basePrice: {
        type: Number,  // Price the company pays for the product
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: null
    }
});

module.exports = productSchema;
