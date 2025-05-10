const jwt = require('jsonwebtoken');

const auth = {};

// Middleware to authenticate and authorize company users
auth.authenticateCompany = async (req, res, next) => {
    try {
        // Get token from cookies
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Add user data (like role) to request object

        // Check if the user is a company and if the company ID matches the one in the request
        if (req.user.role !== 'company') {
            return res.status(403).json({ error: 'Access denied. Only companies can perform this action.' });
        }

        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// Middleware to authenticate consumers
auth.authenticateConsumer = async (req, res, next) => {
    try {
        // Get token from cookies
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Add user data to request

        // Ensure only consumers can submit complaints
        if (req.user.role !== 'consumer') {
            return res.status(403).json({ error: 'Only consumers can submit complaints.' });
        }

        next();
    } catch (err) {
        res.status(401).json({ error: 'Authentication failed' });
    }
};

// Middleware to authenticate admin
auth.authenticateAdmin = async (req, res, next) => {
    try {
        // Get token from cookies
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user data to request

        // Ensure only admins can access
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }

        next();
    } catch (err) {
        res.status(401).json({ error: 'Authentication failed' });
    }
};



// Export the middleware
module.exports = auth;