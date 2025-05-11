
const express = require('express');
const connectDB = require('./db');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser'); // Add this line
const userHandler = require('./routeHandler/userHandler');
const companyHandler = require('./routeHandler/companyHandler');
const consumerHandler = require('./routeHandler/consumerHandler');
const adminHandler = require('./routeHandler/adminHandler');
const blockchainHandler = require('./routeHandler/blockChainHandler');
const productHandler = require('./routeHandler/productHandler');

// express app initialization
const app = express();
dotenv.config();
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true })); // Add this line

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve Bootstrap CSS and JS from node_modules
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

// Connect to MongoDB
connectDB();

// app routes
app.use('/user', userHandler);
app.use('/company', companyHandler);
app.use('/consumer', consumerHandler);
app.use('/admin', adminHandler);
app.use('/blockchain', blockchainHandler);
app.use('/product', productHandler);

app.get('/', (req, res) => {
  res.redirect('/user/login');
});

// default error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) return next(err);
  // render your friendly error page and pass the true message
  res.status(err.status || 500).render('errorHandler', {
    errorCode: err.status || 500,
    errorMessage: err.message || 'Internal Server Error'
  });
  console.log(err);
});

// start the server
app.listen(process.env.PORT, () => {
  console.log(`Server running at http://localhost:${process.env.PORT}`);
});

