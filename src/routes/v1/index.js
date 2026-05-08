const express = require('express');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const projectRoute = require('./project.route');
const objectiveRoute = require('./objective.route');
const targetRoute = require('./target.route');
const activityRoute = require('./activity.route');
const documentRoute = require('./document.route');
const lookupRoute = require('./lookup.route');
const budgetRoute  = require('./budget.route');
const paymentRoute   = require('./payment.route');
const financialRoute  = require('./financial.route');
const inventoryRoute   = require('./inventory.route');
const poRoute          = require('./purchase_order.route');
const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  { path: '/auth', route: authRoute },
  { path: '/users', route: userRoute },
  { path: '/projects', route: projectRoute },
  { path: '/objectives', route: objectiveRoute },
  { path: '/targets', route: targetRoute },
  { path: '/activities', route: activityRoute },
  { path: '/documents', route: documentRoute },
  { path: '/lookups', route: lookupRoute },
  { path: '/budget',     route: budgetRoute },
  { path: '/activities/:activityId/payments', route: paymentRoute },
  { path: '/financial',  route: financialRoute },
  { path: '/inventory',       route: inventoryRoute },
  { path: '/purchase-orders', route: poRoute },
];

defaultRoutes.forEach(({ path, route }) => router.use(path, route));

// Swagger docs in development
if (config.env === 'development') {
  const docsRoute = require('./docs.route');
  router.use('/docs', docsRoute);
}

module.exports = router;
