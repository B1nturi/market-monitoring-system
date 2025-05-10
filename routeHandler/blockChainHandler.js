
const mongoose = require('mongoose');
const express = require('express');
const Blockchain = require('../blockchain');
const block = require('../schemas/block');
const Block = mongoose.model('Block', block);
const router = express.Router();
const { authenticateAdmin, authenticateCompany } = require('../middlewares/authMiddleware');

const blockchain = new Blockchain();

// Route to get the current blockchain
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const blocks = await Block.find({});  // Use the Block model to fetch data
    res.json(blocks);
  } catch (err) {
    res.status(500).send('Error retrieving blockchain');
  }
});

// Route to add a block
// index.js
router.post('/add-block', authenticateCompany, async (req, res) => {
    const { data } = req.body;
  
    try {
      // Get the last block from the database
      const lastBlock = await Block.findOne().sort({ index: -1 }); // Get the block with the highest index
  
      // If no blocks exist (in case of a fresh start), set the index to 0
      const newIndex = lastBlock ? lastBlock.index + 1 : 0;
  
      // Create a new block with the necessary fields
      const newBlock = new Block({
        index: newIndex,  // Increment index from the last block
        timestamp: Date.now(),
        data: data,
        previousHash: lastBlock ? lastBlock.hash : "0",  // Use previous block's hash or "0" for Genesis block
        hash: blockchain.calculateHash(data)  // Generate the hash for the new block
      });
  
      // Save the new block to the database
      //await newBlock.save();
      blockchain.addBlock(data);  // Add to in-memory blockchain chain
  
      res.json({ message: 'Block added to the blockchain', block: newBlock });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add block', details: err.message });
    }
  });
  
  

// Route to validate blockchain
router.get('/validate', authenticateAdmin, (req, res) => {
  if (blockchain.isValid()) {
    res.json({ message: 'Blockchain is valid' });
  } else {
    res.json({ message: 'Blockchain is invalid' });
  }
});

// export the router

module.exports = router;