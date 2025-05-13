const express         = require('express');
const connectDB       = require('./db');
const dotenv          = require('dotenv');
const path            = require('path');
const cookieParser    = require('cookie-parser');
const bodyParser      = require('body-parser');
const Blockchain      = require('./blockchain');       // ← add
const userHandler     = require('./routeHandler/userHandler');
const companyHandler  = require('./routeHandler/companyHandler');
const consumerHandler = require('./routeHandler/consumerHandler');
const adminHandler    = require('./routeHandler/adminHandler');
const blockchainHandler = require('./routeHandler/blockChainHandler');
const productHandler  = require('./routeHandler/productHandler');

dotenv.config();
const app = express();

// middleware
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// view engine + static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

app.use(express.static(path.join(__dirname, 'public')));

async function start() {
  // 1) connect to MongoDB
  await connectDB();
  console.log('MongoDB connected…');

  // 2) instantiate & init your blockchain once
  const blockchain = new Blockchain();
  await blockchain.init();
  app.locals.blockchain = blockchain;
  console.log('In-memory blockchain initialized');

  // 3) wire up routes
  app.use('/user',     userHandler);
  app.use('/company',  companyHandler);
  app.use('/consumer', consumerHandler);
  app.use('/admin',    adminHandler);
  app.use('/blockchain', blockchainHandler);
  app.use('/product',  productHandler);

  app.get('/', (req, res) => res.redirect('/user/login'));

  // error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).render('errorHandler', {
      errorCode:    err.status || 500,
      errorMessage: err.message || 'Internal Server Error'
    });
  });

  // 4) start listening
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});