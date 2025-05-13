const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    metricsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductMetric',
        required: true
    },
    productID: {
        type: String,
        required: true
    },
    sellingPrice: {
        type: Number,
        required: true
    },
    basePrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Flagged', 'Resolved'],
        default: 'Flagged'
    },
    deviation: {
        type: Number, // absolute difference
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = alertSchema;