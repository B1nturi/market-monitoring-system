const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const complaintSchema = require('../schemas/complaintSchema');
const userSchema = require('../schemas/userSchema');
const { authenticateConsumer } = require('../middlewares/authMiddleware');
const productMetricsSchema = require('../schemas/productMetricsSchema');
const productSchema        = require('../schemas/productSchema');
const ProductMetrics       = mongoose.model('ProductMetrics', productMetricsSchema);
const Product              = mongoose.model('Product', productSchema);

// Create a Complaint model
const Complaint = mongoose.model('Complaint', complaintSchema);
const User = mongoose.model('User', userSchema);

// Add this route to fetch consumer's complaints
router.get('/dashboard', authenticateConsumer, async (req, res) => {
    try {
        const complaints = await Complaint.find({ consumerId: req.user.userId }).populate('companyId', 'companyDetails.name');

        res.render('consumerDashboard', { complaints });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching dashboard data' });
    }
});

//
router.get('/submit-complaint', authenticateConsumer, async (req, res) => {
    try {
        const consumerId = req.user.userId;
        const companies = await User.aggregate([
            { $match: { role: 'company' } },
            { $group: { _id: "$companyDetails.name", userId: { $first: "$_id" } } }
        ]);

        res.render('submitComplaint', { consumerId, companies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching dashboard data' });
    }
});

// Submit a complaint (Consumer only)
router.post('/submit-complaint', authenticateConsumer, async (req, res) => {
    try {
        const { companyId, title, description } = req.body;

        if (!companyId || !title || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newComplaint = new Complaint({
            consumerId: req.user.userId,
            companyId,
            title,
            description
        });

        await newComplaint.save();
        res.status(201).json({ message: 'Complaint submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while submitting complaint' });
    }
});

// View consumer’s complaints (Consumer only)
router.get('/my-complaints', authenticateConsumer, async (req, res) => {
    try {
        const complaints = await Complaint.find({ consumerId: req.user.userId });

        res.status(200).json({ message: 'Complaints fetched successfully', data: complaints });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error while fetching complaints' });
    }
});

router.get('/productmetrics', authenticateConsumer, async (req, res) => {
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
module.exports = router;