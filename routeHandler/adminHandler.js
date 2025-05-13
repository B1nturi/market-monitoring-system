const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const router = express.Router();
const userSchema = require('../schemas/userSchema'); // User Schema
const complaintSchema = require('../schemas/complaintSchema'); // Complaint Schema
const blockSchema = require('../schemas/block'); // Block Schema
const abi = require('../public/json/abi.json'); // ABI for smart contract
const productMetricsSchema = require('../schemas/productMetricsSchema');
const productSchema = require('../schemas/productSchema');
const ProductMetrics = mongoose.model('ProductMetrics', productMetricsSchema);
const Product = mongoose.model('Product', productSchema);
const alertSchema = require('../schemas/alertSchema');
const Alert = mongoose.model('Alert', alertSchema);

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
    const complaints = await Complaint.find().populate('companyId', 'companyDetails.name');

    // Fetch data from Block collection
    // const blocks = await Block.find().sort({ index: -1 }).limit(10); // Example: Fetch latest 10 blocks

    res.render('adminDashboard', { companies, complaints });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error while fetching dashboard data' });
  }
});

// Get all company details (Admin only)
router.get('/showblockinfo', authenticateAdmin, async (req, res) => {
  try {
    const blocks = await Block.find().sort({ index: -1 }).limit(10);

    res.render('showBlockInfo', { blocks });
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
    const { status } = req.query; // Get the status filter from the query
    const filter = status ? { status } : {}; // Apply filter only if status is provided
    const complaints = await Complaint.find(filter)
      .populate('consumerId', 'name email') // Populate consumer details
      .populate('companyId', 'companyDetails.name'); // Populate company details

    res.status(200).render('showComplaints', {
      message: 'Complaints fetched successfully',
      data: complaints,
      status // Pass the current status filter to the view
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching complaints' });
  }
});


router.get('/productmetrics', authenticateAdmin, async (req, res, next) => {
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
    if (productName) match['product.productName'] = productName;
    if (batchNumber) match['product.batchNumber'] = batchNumber;
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
        _id: 0,
        productID: 1,
        productName: '$product.productName',
        batchNumber: '$product.batchNumber',
        sellingPrice: 1,
        quantityBought: 1,
        fromCompany: '$fromCompany.companyDetails.name',
        toCompany: '$toCompany.companyDetails.name',
        createdAt: 1
      }
    });

    const metrics = await ProductMetrics.aggregate(pipeline);
    res.render('productMetrics', { metrics, productName, batchNumber });
  } catch (err) {
    next(err);
  }
});

// Route to render the showMetrics page
router.get('/showmetrics', authenticateAdmin, (req, res) => {
  res.render('showMetrics', {
    contractAddress: process.env.CONTRACT_ADDRESS,
    contractABI: abi
  });
});

router.get('/isRegistered', authenticateAdmin, async (req, res) => {
  try {
    // fetch companies for the dropdown
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

    // pull address from env
    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress || !contractAddress.startsWith('0x')) {
      throw new Error('Missing or invalid CONTRACT_ADDRESS');
    }

    // abi was required at top: const abi = require('../public/json/abi.json');
    if (!abi || !Array.isArray(abi) || abi.length === 0) {
      throw new Error('Missing or invalid CONTRACT_ABI');
    }

    res.render('isRegistered', {
      toCompanies,
      contractAddress,
      abi   // pass it exactly as the template expects
    });
  }
  catch (error) {
    next(error)
  }
});

router.post('/updateComplaintStatus', async (req, res) => {
  const { complaintId, status } = req.body;
  try {
    await Complaint.findByIdAndUpdate(complaintId, { status });
    res.redirect('/admin/complaints'); // Redirect back to the dashboard
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating complaint status');
  }
});


// Route: list all alerts with joined product & company info
router.get('/alertlist', authenticateAdmin, async (req, res, next) => {
  try {
    const { status: filterStatus } = req.query;
    const pipeline = [];

    // 0) optional filter on alert.status
    if (filterStatus) {
      pipeline.push({ $match: { status: filterStatus } });
    }

    // 1) get the metrics doc
    pipeline.push(
      {
        $lookup: {
          from: 'productmetrics',
          localField: 'metricsId',
          foreignField: '_id',
          as: 'metrics'
        }
      },
      { $unwind: '$metrics' },

      // 2) product info
      {
        $lookup: {
          from: 'products',
          localField: 'metrics.productID',
          foreignField: 'productID',
          as: 'product'
        }
      },
      { $unwind: '$product' },

      // 3) from‐company
      {
        $lookup: {
          from: 'users',
          localField: 'metrics.companyId',
          foreignField: '_id',
          as: 'fromCompany'
        }
      },
      { $unwind: { path: '$fromCompany', preserveNullAndEmptyArrays: true } },

      // 4) to‐company
      {
        $lookup: {
          from: 'users',
          localField: 'metrics.toCompany',
          foreignField: '_id',
          as: 'toCompany'
        }
      },
      { $unwind: { path: '$toCompany', preserveNullAndEmptyArrays: true } },

      // 5) project fields including status
      {
        $project: {
          _id:            1,
          productName:    '$product.productName',
          batchNumber:    '$product.batchNumber',
          origin:         '$product.manufacturer',
          quantityBought: '$metrics.quantityBought',
          basePrice:      1,
          sellingPrice:   1,
          deviation:      1,
          status:         1,
          fromCompany:    '$fromCompany.companyDetails.name',
          toCompany:      '$toCompany.companyDetails.name',
          alertTime:      '$createdAt'
        }
      }
    );

    const alerts = await Alert.aggregate(pipeline);
    res.render('alertList', { alerts, filterStatus });
  } catch (err) {
    next(err);
  }
});


router.post('/alert/:id/resolve', authenticateAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await Alert.findByIdAndUpdate(id, { status: 'Resolved' });
    res.redirect(`/admin/alertlist?status=${req.query.status||''}`);
  } catch(err) {
    next(err);
  }
});


// Export the router
module.exports = router;