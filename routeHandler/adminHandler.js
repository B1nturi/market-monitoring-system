const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const router = express.Router();
const userSchema = require('../schemas/userSchema'); // User Schema
const complaintSchema = require('../schemas/complaintSchema'); // Complaint Schema
const blockSchema = require('../schemas/block'); // Block Schema

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

// Export the router
module.exports = router;