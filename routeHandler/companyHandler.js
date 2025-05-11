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

// Assuming you've already created a model for company data.
const ProductMetrics = mongoose.model('ProductMetric', productMetricsSchema);
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', product);
const Block = mongoose.model('Block', block);

// Helper function to generate product ID
const generateProductID = (companyID, productName, batchNumber) => {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    return `'${companyID}'-'${batchNumber}'-'${cleanName}'`;
};

// Add this route to fetch company details and products
router.get('/dashboard', authenticateCompany, async (req, res) => {
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        const companyId = decoded.userId;

        // Fetch company details
        const company = await User.findById(companyId);

        // Fetch products of the company
        const products = await Product.find({ companyId });

        res.render('companyDashboard', { company, products });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching dashboard data' });
    }
});

// Example Express route
router.get('/submit-product', async (req, res) => {
    // Fetch data here from your respective DB model collections

    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const companyId = decoded.userId;
    const products = await Product.find({ companyId });
    // console.log(products);

    // Fetch unique company names along with their user IDs
    const toCompanies = await User.aggregate([
        { $match: { role: 'company' } },
        { $group: { _id: "$companyDetails.name", userId: { $first: "$_id" } } }
    ]);

    res.render('productMetricsForm', { companyId, products, toCompanies });
});

// Create a new product submission (Company only)
router.post('/submit-product', authenticateCompany, async (req, res) => {
    try {
        const { companyId, productID, productOrigin, toCompany, sellingPrice, quantityBought } = req.body;

        if (!companyId || !productID || !toCompany || !sellingPrice || !quantityBought) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Ensure that the company is submitting data for their own company
        if (req.user.userId.toString() !== companyId.toString()) {
            return res.status(403).json({ error: 'You can only submit data for your own company.' });
        }

        // Fetch the product details using the productID
        const product = await Product.findOne({ productID });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Generate unique product ID
        const newProductID = generateProductID(toCompany, product.productName, product.batchNumber);

        const newProductMetrics = new ProductMetrics({
            companyId,
            productID,
            productOrigin,
            toCompany,
            sellingPrice,
            quantityBought
        });

        const newProduct = new Product({
            productID: newProductID,
            productName: product.productName,
            batchNumber: product.batchNumber,
            manufacturer: product.manufacturer,
            basePrice: product.basePrice,
            quantity: quantityBought,
            companyId: toCompany
        });

        await newProductMetrics.save();
        await newProduct.save();

        const blockchain = new Blockchain();
        const lastBlock = await Block.findOne().sort({ index: -1 });
        const newIndex = lastBlock ? lastBlock.index + 1 : 0;

        await blockchain.addBlock(newProduct);

        res.status(201).json({ message: 'Product submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while submitting product' });
    }
});

router.get('/view-submissions', authenticateCompany, async (req, res) => {
    try {
        const submissions = await ProductMetrics.find();
        res.status(200).json({ message: 'Submissions fetched successfully', data: submissions });
    } catch (err) {
        res.status(500).json({ error: 'Error while fetching submissions' });
    }
});

// export the router
module.exports = router;