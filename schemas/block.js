// models/block.js
const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  previousHash: { type: String, required: true },
  hash: { type: String, required: true }
});

module.exports = mongoose.model('Block', blockSchema);  // Make sure to export the model correctly
