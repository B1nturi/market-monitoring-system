const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    consumerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',  // Reference to the User model (assuming consumers are users)
        required: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',  // Reference to the company the complaint is against
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    companyResponse: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ['Progressing', 'Responded', 'Resolved', 'Rejected'],
        default: 'Progressing'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// export the schema
module.exports = complaintSchema;
