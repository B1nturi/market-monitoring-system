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
const { ethers } = require("ethers");
const abi = require("../public/json/abi.json");
const dotenv = require("dotenv");
dotenv.config();

// Assuming you've already created a model for company data.
const ProductMetrics = mongoose.model('ProductMetric', productMetricsSchema);
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', product);
const Block = mongoose.model('Block', block);

// Helper function to generate product ID
const generateProductID = (companyID, productName, batchNumber) => {
    const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    return `${companyID}${batchNumber}${cleanName}`;
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

        const contractAddress = process.env.CONTRACT_ADDRESS;
        const abi = require('../public/json/abi.json');
        res.render('companyDashboard', {
            company,
            products,
            contractAddress,
            abi
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching dashboard data' });
    }
});

router.get('/submit-product', authenticateCompany, async (req, res) => {
    const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    const companyId = decoded.userId;

    // load all companies (except the current one) with their nested wallet
    const companies = await User
        .find({ role: 'company', _id: { $ne: companyId } })
        .select('companyDetails.walletaddress')   // pull only the nested field
        .lean();

    // map into the shape your EJS expects
    const toCompanies = companies.map(c => ({
        userId: c._id.toString(),
        walletaddress: c.companyDetails.walletaddress
    }));

    res.render('productMetricsForm', {
        companyId,
        products: await Product.find({ companyId }).lean(),
        toCompanies,
        contractAddress: process.env.CONTRACT_ADDRESS,
        abi: JSON.stringify(require('../public/json/abi.json'))
    });
});

// POST – expect transactionHash, verify it succeeded on‐chain first
router.post('/submit-product', authenticateCompany, async (req, res) => {
    console.log("=== /submit-product form data ===");
    Object.entries(req.body).forEach(([key, value]) => {
        console.log(`${key}:`, value);
    });
    try {
        const {
            companyId,
            productID,
            productOrigin,
            toCompany,
            sellingPrice,
            quantityBought,
            transactionHash
        } = req.body;

        // 1) Ensure transactionHash is present (or remove this check if you don't care)
        if (!transactionHash) {
            return res.status(400).json({ error: 'Missing transactionHash' });
        }

        // 2) Load the Product so you can read its productName & batchNumber
        const product = await Product.findOne({ productID }).lean();
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }


        // 3) Generate your composite product ID
        const newProductID = generateProductID(
            toCompany,
            product.productName,
            product.batchNumber
        );


        // 4) Save ProductMetrics
        const newProductMetrics = new ProductMetrics({
            companyId,
            productID,
            productOrigin,
            toCompany,
            sellingPrice,
            quantityBought
        });
        await newProductMetrics.save();


        // 5) Save the actual Product record under the new ID

        const newProduct = new Product({
            productID: newProductID,
            productName: product.productName,
            batchNumber: product.batchNumber,
            manufacturer: product.manufacturer,
            basePrice: product.basePrice,
            quantity: quantityBought,
            companyId: toCompany
        });
        await newProduct.save();


        if (product.quantity < quantityBought) {
            return res.status(400).json({ error: 'Insufficient quantity available' });
        }

        const updateQuantity = await Product.findOneAndUpdate(
            {
                productID: product.productID
            },
            { quantity: product.quantity - quantityBought },
            { new: true }
        );

        if (!updateQuantity) {
            return res.status(404).json({ error: 'Quantity not found or unauthorized' });
        }


        const blockchain = req.app.locals.blockchain;
        await blockchain.addBlock(newProduct);




        res.json({ message: 'Saved on-chain & in DB' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
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

router.get('/productmetrics', authenticateCompany, async (req, res, next) => {
  try {
    const { productName, batchNumber } = req.query;
    const pipeline = [
      // 1) join in product details
      {
        $lookup: {
          from: 'products',
          localField: 'productID',
          foreignField: 'productID',
          as: 'product'
        }
      },
      { $unwind: '$product' }
    ];

    // 2) optional filters
    const match = {};
    if (productName)  match['product.productName'] = productName;
    if (batchNumber)  match['product.batchNumber'] = batchNumber;
    if (Object.keys(match).length) pipeline.push({ $match: match });

    // 3) join “from” company
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'companyId',
          foreignField: '_id',
          as: 'fromCompany'
        }
      },
      { $unwind: { path: '$fromCompany', preserveNullAndEmptyArrays: true } }
    );

    // 4) join “to” company
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'toCompany',
          foreignField: '_id',
          as: 'toCompany'
        }
      },
      { $unwind: { path: '$toCompany', preserveNullAndEmptyArrays: true } }
    );

    // 5) shape the output
    pipeline.push({
      $project: {
        _id:            0,
        productID:      1,
        productName:    '$product.productName',
        batchNumber:    '$product.batchNumber',
        sellingPrice:   1,
        quantityBought: 1,
        fromCompany:    '$fromCompany.companyDetails.name',
        toCompany:      '$toCompany.companyDetails.name',
        createdAt:      1
      }
    });

    const metrics = await ProductMetrics.aggregate(pipeline);
    res.render('productMetrics', { metrics, productName, batchNumber });
  } catch (err) {
    next(err);
  }
});


// export the router
module.exports = router;