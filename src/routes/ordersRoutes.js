const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const orderController = require('../controllers/orderController');
const controller = new orderController();

router.post('/', auth, controller.createOrder.bind(controller));
router.get('/', auth, controller.listOrders.bind(controller));
router.get('/:id', auth, controller.getOrder.bind(controller));

module.exports = router;