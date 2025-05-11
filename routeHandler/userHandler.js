const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const userSchema = require('../schemas/userSchema');

// Correct way to define the model
const User = mongoose.model('User', userSchema);

// Render signup page
router.get('/signup', (req, res) => {
    res.render('signup');
});

// Signup
router.post('/signup', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const newUser = new User({
            name: req.body.name,
            username: req.body.username,
            password: hashedPassword,
            role: req.body.role,
            email: req.body.email,
            phone: req.body.phone,
            status: req.body.status || 'active',
            companyDetails: req.body.role === 'company' ? req.body.companyDetails : undefined
        });
        await newUser.save();
        res.status(201).json({ message: 'User added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "There was an error while adding the user"});
    }
});

// Render login page
router.get('/login', (req, res) => {
    res.render('login');
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password, ethAddress } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).render('login', { error: "Authorization failed" });
        }

        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign(
                { username: user.username, userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Set the JWT and Ethereum address in cookies
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 3600000 // 1 hour
            });

            res.cookie('ethAddress', ethAddress, {
                httpOnly: false, // Allow access from client-side JS if needed
                secure: true,
                sameSite: 'strict',
                maxAge: 3600000
            });

            // Redirect based on role
            if (user.role === 'admin') {
                res.redirect('/admin/dashboard');
            } else if (user.role === 'company') {
                res.redirect('/company/dashboard');
            } else if (user.role === 'consumer') {
                res.redirect('/consumer/dashboard');
            } else {
                res.status(400).render('login', { error: "Invalid user role" });
            }
        } else {
            res.status(401).render('login', { error: "Invalid credentials" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).render('login', { error: "There was an error while logging in" });
    }
});


// Logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/user/login');
});

// Get all users
router.get('/all', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ message: 'Users fetched successfully', data: users });
    } catch (err) {
        res.status(500).json({ error: "There was an error while getting the users" });
    }
});

// Export the router
module.exports = router;