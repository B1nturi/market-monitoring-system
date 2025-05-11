const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const jwt = require('jsonwebtoken');
const productMetricsSchema = require('../schemas/productMetricsSchema');
const userSchema = require('../schemas/userSchema');
const product = require('../schemas/productSchema');
const Blockchain = require('../blockchain');
const { authenticateCompany } = require('../middlewares/authMiddleware');
const block = require('../schemas/block');
const { ethers } = require("ethers");  // Importing ethers.js
const dotenv = require('dotenv');
dotenv.config();

// Assuming you've already created a model for company data.
const ProductMetrics = mongoose.model('ProductMetric', productMetricsSchema);
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', product);
const Block = mongoose.model('Block', block);

// Ethereum contract details
const contractAddress = process.env.CONTRACT_ADDRESS;
const abi = require('../smartContract/product_eth_abi.json');
const provider = new ethers.JsonRpcProvider(process.env.INFURA_API_URL);
const contract = new ethers.Contract(contractAddress, abi, provider);

// Fetch the products by company address from the blockchain
async function getProductsByCompany(companyAddress) {
    const products = await contract.getProductsByCompany(companyAddress);
    return products.map(product => ({
        productID: product.productID,
        productName: product.productName,
        manufacturer: product.manufacturer,
        basePrice: product.basePrice, // Format base price if it's in wei
        createdAt: product.createdAt.toString(),
    }));
}

router.get('/dashboard', authenticateCompany, async (req, res) => {
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const companyId = decoded.userId;

        // Fetch company details
        const company = await User.findById(companyId);
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // ✅ Get Ethereum address from cookie OR from company record
        const companyAddress = req.cookies.ethAddress || company.companyDetails?.address;

        if (!companyAddress) {
            return res.status(400).json({ error: 'Company Ethereum address not found.' });
        }

        // Fetch products from the blockchain
        const blockchainProducts = await getProductsByCompany(companyAddress);

        // Fetch products from database
        const products = await Product.find({ companyId });

        res.render('companyDashboard', { company, products: blockchainProducts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching dashboard data' });
    }
});

// Example Express route
router.get('/submit-product', async (req, res) => {
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const companyId = decoded.userId;

    // Fetch products for the company from the blockchain
    const company = await User.findById(companyId);
    const companyAddress = req.cookies.ethAddress || company.companyDetails?.address;

    if (!companyAddress) {
        return res.status(400).json({ error: 'Company Ethereum address not found.' });
    }
    const blockchainProducts = await getProductsByCompany(companyAddress);

    // Fetch unique company names along with their user IDs for submission purposes
    const toCompanies = await User.aggregate([
        { $match: { role: 'company' } },
        { $group: { _id: "$companyDetails.name", userId: { $first: "$_id" } } }
    ]);

    res.render('productMetricsForm', { companyId, products: blockchainProducts, toCompanies });
});

// Create a new product submission (Company only)
router.post('/submit-product', authenticateCompany, async (req, res) => {
    try {
        const { companyId, productID, productOrigin, toCompany, sellingPrice, quantityBought } = req.body;

        if (!companyId || !productID || !toCompany || !sellingPrice || !quantityBought) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (req.user.userId.toString() !== companyId.toString()) {
            return res.status(403).json({ error: 'You can only submit data for your own company.' });
        }

        const newProduct = new ProductMetrics({
            companyId,
            productID,
            productOrigin,
            toCompany,
            sellingPrice,
            quantityBought
        });

        await newProduct.save();

        const blockchain = new Blockchain();
        const lastBlock = await Block.findOne().sort({ index: -1 });
        const newIndex = lastBlock ? lastBlock.index + 1 : 0;

        await blockchain.addBlock(newProduct); // Add to blockchain

        res.status(201).json({ message: 'Product submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while submitting product' });
    }
});

// Fetch all product metrics submissions
router.get('/view-submissions', authenticateCompany, async (req, res) => {
    try {
        const submissions = await ProductMetrics.find();
        res.status(200).json({ message: 'Submissions fetched successfully', data: submissions });
    } catch (err) {
        res.status(500).json({ error: 'Error while fetching submissions' });
    }
});

// Export the router
module.exports = router;
