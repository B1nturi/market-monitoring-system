const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const jwt = require('jsonwebtoken');
const productSchema = require('../schemas/productSchema');
const { authenticateCompany, authenticateAdmin } = require('../middlewares/authMiddleware');
const { ethers } = require('ethers');
const contractABI = require('../smartContract/product_eth_abi.json');
const dotenv = require('dotenv');
dotenv.config();
// Setup Mongoose model
const Product = mongoose.model('Product', productSchema);

// Setup ethers

const provider = new ethers.JsonRpcProvider(process.env.INFURA_API_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);

// Helper: Generate unique product ID
const generateProductID = (companyID, productName) => {
  const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${companyID}|${cleanName}`;
};

// Route: Show add product form
router.get('/add', authenticateCompany, (req, res) => {
  res.render('addProduct');
});

// Route: Create new product (DB + Blockchain)
// Route: Create new product (DB + Blockchain)
router.post('/create', authenticateCompany, async (req, res) => {
  try {
    const { productName, manufacturer, basePrice } = req.body;
    const token = req.cookies.token;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const companyId = decoded.userId;
    const productID = generateProductID(manufacturer, productName);

    const existingProduct = await Product.findOne({ productID });
    if (existingProduct) {
      return res.status(400).json({ error: 'Product already exists' });
    }

    

    // Save to MongoDB
    const newProduct = new Product({
      productID,
      productName,
      manufacturer,
      basePrice,
      companyId
    });

    await newProduct.save();
    res.status(201).json({ message: 'Product created', product: newProduct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating product' });
  }
});


// Route: Get products for current company
router.get('/myproducts', authenticateCompany, async (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const companyId = decoded.userId;

    const products = await Product.find({ companyId });
    res.status(200).json({ data: products });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// Route: Get all products
router.get('/all/:companyId?', authenticateAdmin, async (req, res) => {
  try {
    const query = req.params.companyId ? { companyId: req.params.companyId } : {};
    const products = await Product.find(query).populate('companyId', 'companyName').sort({ createdAt: -1 });
    res.status(200).json({ data: products });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching all products' });
  }
});

// Route: Get product by ID
router.get('/id/:productID', async (req, res) => {
  try {
    const product = await Product.findOne({ productID: req.params.productID }).populate('companyId', 'companyName');
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ data: product });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// Route: Update product (DB + Blockchain)
router.put('/:productID', authenticateCompany, async (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const companyId = decoded.userId;

    const updates = { ...req.body, updatedAt: Date.now() };
    const product = await Product.findOneAndUpdate(
      { productID: req.params.productID, companyId },
      updates,
      { new: true }
    );

    if (!product) return res.status(404).json({ error: 'Not found or unauthorized' });

    const tx = await contract.updateProduct(
      req.params.productID,
      product.productName,
      product.manufacturer,
      product.basePrice
    );
    await tx.wait();

    res.status(200).json({ message: 'Product updated', data: product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating product' });
  }
});

// Route: Delete product (DB + Blockchain)
router.delete('/:productID', authenticateCompany, async (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const companyId = decoded.userId;

    const product = await Product.findOneAndDelete({ productID: req.params.productID, companyId });
    if (!product) return res.status(404).json({ error: 'Not found or unauthorized' });

    const tx = await contract.deleteProduct(req.params.productID);
    await tx.wait();

    res.status(200).json({ message: 'Product deleted', data: product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting product' });
  }
});

module.exports = router;
