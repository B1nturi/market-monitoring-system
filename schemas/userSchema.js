const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'consumer', 'company'],
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    companyDetails: {
        name: String,
        registrationNumber: String,
        address: String,
        website: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// export the schema
module.exports = userSchema;
