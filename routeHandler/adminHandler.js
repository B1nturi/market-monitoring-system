const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const router = express.Router();
const userSchema = require('../schemas/userSchema'); // User Schema
const complaintSchema = require('../schemas/complaintSchema'); // Complaint Schema
const blockSchema = require('../schemas/block'); // Block Schema
const abi = require('../public/json/abi.json'); // ABI for smart contract
const productMetricsSchema = require('../schemas/productMetricsSchema');
const productSchema        = require('../schemas/productSchema');
const ProductMetrics       = mongoose.model('ProductMetrics', productMetricsSchema);
const Product              = mongoose.model('Product', productSchema);
require('dotenv').config();
// Models
const User = mongoose.model('User', userSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);
const Block = mongoose.model('Block', blockSchema);

// Middleware
const { authenticateAdmin } = require('../middlewares/authMiddleware');

// Add this route to fetch company details, complaints, and block data
router.get('/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Fetch all companies
        const companies = await User.find({ role: 'company' }).select('-password'); // Exclude passwords

        // Fetch all complaints
        const complaints = await Complaint.find().populate('consumerId', 'name email').populate('companyId', 'companyDetails.name');

        // Fetch data from Block collection
        // const blocks = await Block.find().sort({ index: -1 }).limit(10); // Example: Fetch latest 10 blocks

        res.render('adminDashboard', { companies, complaints});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching dashboard data' });
    }
});

// Get all company details (Admin only)
router.get('/showblockinfo', authenticateAdmin, async (req, res) => {
    try {
        const blocks = await Block.find().sort({ index: -1 }).limit(10);

        res.render('showBlockInfo', { blocks});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching block info details' });
    }
});

router.get('/addcompany', authenticateAdmin, async (req, res) => {
    try {
        const toCompanies = await User.aggregate([
            { $match: { role: 'company' } },
            {
                $group: {
                    _id: "$companyDetails.name",
                    userId: { $first: "$_id" },
                    walletaddress: { $first: "$companyDetails.walletaddress" }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    walletaddress: 1,
                    userId: 1
                }
            }
        ]);

        res.render('addCompany', { toCompanies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching company details' });
    }
});

router.get('/revokecompany', authenticateAdmin, async (req, res) => {
    try {
        const toCompanies = await User.aggregate([
            { $match: { role: 'company' } },
            {
                $group: {
                    _id: "$companyDetails.name",
                    userId: { $first: "$_id" },
                    walletaddress: { $first: "$companyDetails.walletaddress" }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    walletaddress: 1,
                    userId: 1
                }
            }
        ]);

        res.render('revokecompany', { toCompanies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching company details' });
    }
});

// Get all company details (Admin only)
router.get('/companies', authenticateAdmin, async (req, res) => {
    try {
        const companies = await User.find({ role: 'company' }).select('-password'); // Exclude passwords

        res.status(200).json({ message: 'Companies fetched successfully', data: companies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching company details' });
    }
});

// Get all company details (Admin only)
router.get('/company/:id/json', authenticateAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .lean();
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
// Get all consumer complaints (Admin only)
router.get('/complaints', authenticateAdmin, async (req, res) => {
    try {
        const complaints = await Complaint.find().populate('consumerId', 'name email').populate('companyId', 'companyDetails.name');

        res.status(200).json({ message: 'Complaints fetched successfully', data: complaints });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching complaints' });
    }
});



router.get('/productmetrics', authenticateAdmin, async (req, res) => {
  try {
    const { productName, batchNumber } = req.query;
    const pipeline = [
      // join in product details
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

    // optional filters
    const match = {};
    if (productName)  match['product.productName'] = productName;
    if (batchNumber)  match['product.batchNumber'] = batchNumber;
    if (Object.keys(match).length) pipeline.push({ $match: match });

    // join in company names
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'companyId',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: '$company' },
      // shape the output
      {
        $project: {
          _id:           0,
          productID:     1,
          productName:   '$product.productName',
          batchNumber:   '$product.batchNumber',
          sellingPrice:  1,
          quantityBought:1,
          companyName:   '$company.companyDetails.name',
          createdAt:     1
        }
      }
    );

    const metrics = await ProductMetrics.aggregate(pipeline);
    res.render('productMetrics', { metrics, productName, batchNumber });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Route to render the showMetrics page
router.get('/showmetrics', authenticateAdmin, (req, res) => {
  res.render('showMetrics', {
    contractAddress: process.env.CONTRACT_ADDRESS,
    contractABI: abi
  });
});

router.post('/updateComplaintStatus', async (req, res) => {
    const { complaintId, status } = req.body;
    try {
        await Complaint.findByIdAndUpdate(complaintId, { status });
        res.redirect('/admin/dashboard'); // Redirect back to the dashboard
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating complaint status');
    }
});

// Export the router
module.exports = router;