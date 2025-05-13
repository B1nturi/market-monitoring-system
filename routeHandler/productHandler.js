const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const productSchema = require('../schemas/productSchema');
const jwt = require('jsonwebtoken');
const { authenticateCompany, authenticateAdmin } = require('../middlewares/authMiddleware');

// mongoose model
const Product = mongoose.model('Product', productSchema);

// Helper function to generate product ID
const generateProductID = (companyID, productName, batchNumber) => {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    return `${companyID}${batchNumber}${cleanName}`;
};

// Add this route to render the add product form
router.get('/add', authenticateCompany, (req, res) => {
    res.render('addProduct');
});

// Create a new product
router.post('/create', authenticateCompany, async (req, res) => {
    try {
        const { productName, batchNumber, manufacturer, basePrice, quantity  } = req.body;
        
        const companyId = req.cookies.token;

        if (!companyId) {
            return res.status(401).json({ error: 'Please login to continue' });
        }

        const decoded = jwt.verify(companyId, process.env.JWT_SECRET);
        const actualCompanyId = decoded.userId;

        if (!productName || !batchNumber || !manufacturer || !basePrice || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate unique product ID
        const productID = generateProductID(actualCompanyId, productName, batchNumber);

        // Check if product ID already exists
        const existingProduct = await Product.findOne({ productID });
        console.log(existingProduct);
        if (existingProduct) {
            return res.status(400).json({ error: 'Product ID already exists. Please try again.' });
        }

        const newProduct = new Product({
            productID,
            productName,
            batchNumber,
            manufacturer,
            basePrice,
            quantity,
            companyId: actualCompanyId
        });

        await newProduct.save();
        res.redirect('/company/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating product' });
    }
});


// Get product stock by product name (admin only)
router.get('/stock/:productName', authenticateAdmin, async (req, res) => {
    try {
        // Get the product name from the request parameters
        const productName = req.params.productName;

        // Find products matching the product name (case-insensitive partial match)
        const products = await Product.find({
            productName: { $regex: new RegExp(productName, 'i') } // Case-insensitive search
        }).populate('companyId', 'companyDetails.name companyDetails.address email'); // Populate company details

        // If no products are found, return a 404 error
        if (products.length === 0) {
            return res.status(404).json({ error: 'No products found with the given name' });
        }

        // Calculate the total stock and group by company
        const totalStock = products.reduce((sum, product) => sum + product.quantity, 0);
        const stockByCompany = products.reduce((acc, product) => {
            const companyName = product.companyId?.companyDetails?.name || 'Unknown Company';
            acc[companyName] = (acc[companyName] || 0) + product.quantity;
            return acc;
        }, {});

        // Respond with the stock details and similar products
        res.status(200).json({
            message: 'Stock fetched successfully',
            productName,
            totalStock,
            stockByCompany,
            similarProducts: products.map(product => ({
                productName: product.productName,
                quantity: product.quantity,
                companyName: product.companyId?.companyDetails?.name || 'Unknown Company',
                companyAddress: product.companyId?.companyDetails?.address || 'Unknown Address',
                companyEmail: product.companyId?.email || 'Unknown Email'
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stock' });
    }
});

router.get('/stock', authenticateAdmin, async (req, res) => {
    try {
        // Render the EJS file for product stock
        res.render('adminStockDetails',{
            message: null, // Initial message (can be updated dynamically)
            productName: null, // No product selected initially
            totalStock: null, // No stock data initially
            stockByCompany: null // No company data initially
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error rendering product stock page' });
    }
});
 
// Search for products by name (admin only)
router.get('/search', authenticateAdmin, async (req, res) => {
    try {
        const query = req.query.query || '';
        const products = await Product.find({
            productName: { $regex: new RegExp(query, 'i') } // Case-insensitive search
        }).select('productName');

        // Filter out duplicate product names
        const uniqueProducts = products.reduce((acc, product) => {
            if (!acc.some(p => p.productName === product.productName)) {
            acc.push(product);
            }
            return acc;
        }, []).slice(0, 10); // Limit results to 10

        res.status(200).json(uniqueProducts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching products' });
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
router.post('/edit/:productID', authenticateCompany, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Please login to continue' });
        }
        
        const { productID } = req.params;
        console.log('Product ID:', productID);
        const updates = {
            ...req.body,
            updatedAt: Date.now()
        };

        const product = await Product.findOneAndUpdate(
            { 
                productID: productID
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
router.post('/delete/:productID', authenticateCompany, async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Please login to continue' });
        }

        const product = await Product.findOneAndDelete({ 
            productID: req.params.productID
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