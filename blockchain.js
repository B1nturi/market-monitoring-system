const crypto   = require('crypto');
const mongoose = require('mongoose');
const BlockDef = require('./schemas/block');
const Block    = mongoose.model('Block', BlockDef);

class Blockchain {
  constructor() {
    this.chain = [];
  }

  // call this once, after you connect to Mongo
  async init() {
    await this.loadBlockchain();
  }

  async loadBlockchain() {
    try {
      // load every block, in order
      const blocks = await Block.find().sort({ index: 1 }).lean();
      if (blocks.length === 0) {
        // create Genesis
        const timestamp = Date.now();
        const genesis = {
          index:        0,
          timestamp,
          data:         'Genesis Block',
          previousHash: '0',
          hash:         this.calculateHash('Genesis Block', timestamp)
        };
        await new Block(genesis).save();
        this.chain = [genesis];
      } else {
        this.chain = blocks;
      }
    } catch (err) {
      console.error('Error loading blockchain:', err);
    }
  }

  async addBlock(newBlockData) {
    // ensure you’ve already run init()
    const previousBlock = this.chain[this.chain.length - 1];
    const timestamp     = Date.now();
    const newBlock      = {
      index:        this.chain.length,
      timestamp,
      data:         newBlockData,
      previousHash: previousBlock.hash,
      hash:         this.calculateHash(newBlockData, timestamp)
    };

    await new Block(newBlock).save();
    this.chain.push(newBlock);
    return newBlock;
  }

  calculateHash(data, timestamp) {
    return crypto.createHash('sha256')
      .update(data + timestamp)
      .digest('hex');
  }

  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];
      if (curr.hash !== this.calculateHash(curr.data, curr.timestamp)) return false;
      if (curr.previousHash !== prev.hash)                         return false;
    }
    return true;
  }
}

module.exports = Blockchain;