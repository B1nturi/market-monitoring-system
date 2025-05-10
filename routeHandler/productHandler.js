const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const productSchema = require('../schemas/productSchema');
const jwt = require('jsonwebtoken');
const { authenticateCompany, authenticateAdmin } = require('../middlewares/authMiddleware');

// mongoose model
const Product = mongoose.model('Product', productSchema);

// Helper function to generate product ID
const generateProductID = (companyID, productName) => {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    return `'${companyID}'|'${cleanName}'`;
};

// Add this route to render the add product form
router.get('/add', authenticateCompany, (req, res) => {
    res.render('addProduct');
});

// Create a new product
router.post('/create', authenticateCompany, async (req, res) => {
    try {
        const { productName, manufacturer, basePrice } = req.body;
        
        const companyId = req.cookies.token;

        if (!companyId) {
            return res.status(401).json({ error: 'Please login to continue' });
        }

        const decoded = jwt.verify(companyId, process.env.JWT_SECRET);
        const actualCompanyId = decoded.userId;

        if (!productName || !manufacturer || !basePrice) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate unique product ID
        const productID = generateProductID(actualCompanyId, productName);
        console.log(productID);

        // Check if product ID already exists
        const existingProduct = await Product.findOne({ productID });
        console.log(existingProduct);
        if (existingProduct) {
            return res.status(400).json({ error: 'Product ID already exists. Please try again.' });
        }

        const newProduct = new Product({
            productID,
            productName,
            manufacturer,
            basePrice,
            companyId: actualCompanyId
        });

        await newProduct.save();
        res.status(201).json({ 
            message: 'Product created successfully',
            product: newProduct 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating product' });
    }
});

// Get all products for the authenticated company
router.get('/myproducts', authenticateCompany, async (req, res) => {
    console.log('Inside myproducts');
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Please login to continue' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const companyId = decoded.userId;
        
        const products = await Product.find({ companyId });
        
        res.status(200).json({ 
            message: 'Products fetched successfully',
            data: products 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching products' }); // Changed from 1000 to 500
    }
});

// Get all products (accessible to all)
router.get('/all/:companyId?', authenticateAdmin, async (req, res) => {
    try {
        let query = {};
        if (req.params.companyId) {
            query.companyId = req.params.companyId;
        }

        const products = await Product.find(query)
            .populate('companyId', 'companyName')
            .sort({ createdAt: -1 });

        res.status(200).json({ 
            message: 'Products fetched successfully',
            count: products.length,
            data: products 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching products' });
    }
});

// Add this route after your existing routes
router.get('/id/:productID', async (req, res) => {
    try {
        const product = await Product.findOne({ 
            productID: req.params.productID 
        }).populate('companyId', 'companyName');

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json({
            message: 'Product fetched successfully',
            data: product
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching product' });
    }
});

// put product by ID
router.put('/:productID', authenticateCompany, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Please login to continue' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const companyId = decoded.userId;
        
        companyID = await Product.find({ companyId });

        const updates = {
            ...req.body,
            updatedAt: Date.now()
        };

        const product = await Product.findOneAndUpdate(
            { 
                productID: req.params.productID,
                companyId
            },
            updates,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found or unauthorized' });
        }

        res.status(200).json({ 
            message: 'Product updated successfully',
            data: product 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating product' });
    }
});


// Delete product (only by owning company)
router.delete('/:productID', authenticateCompany, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Please login to continue' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const companyId = decoded.userId;

        const product = await Product.findOneAndDelete({ 
            productID: req.params.productID,
            companyId
        });
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found or unauthorized' });
        }

        res.status(200).json({ 
            message: 'Product deleted successfully',
            data: product 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting product' });
    }
});

module.exports = router;