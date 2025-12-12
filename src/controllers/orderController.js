const OrderService = require('../services/OrderService');

// factory opcional: inyecta opciones (apiKey desde env)
const paymentOptions = { apiKey: process.env.PAYMENT_API_KEY, timeout: process.env.PAYMENT_TIMEOUT ? Number(process.env.PAYMENT_TIMEOUT) : undefined };
const svc = new OrderService({ paymentOptions });

class orderController {
    async createOrder(req, res) {
    try {
        const user = req.user;
        if (!user || !user.id) return res.status(401).json({ status: 'fail', data: { message: 'Unauthorized' } });

        const { items, paymentMethod, paymentDetails, currency } = req.body;

        const result = await svc.createAndPay({ userId: user.id, items, paymentMethod, paymentDetails, currency });

        if (!result.success) {
        return res.status(400).json({ status: 'fail', data: { message: 'Payment failed', reason: result.reason, payment: result.payment, orderId: result.orderId } });
        }

        return res.status(201).json({ status: 'success', data: result.order });
    } catch (err) {
        console.error('[orders.createOrder]', err);
        return res.status(500).json({ status: 'error', message: err.message });
    }
    }

    async listOrders(req, res) {
    try {
        const user = req.user;
        if (!user || !user.id) return res.status(401).json({ status: 'fail', data: { message: 'Unauthorized' } });

        const { page, limit } = req.query;
        const data = await svc.listUserOrders({ userId: user.id, page, limit });
        return res.json({ status: 'success', data });
    } catch (err) {
        console.error('[orders.listOrders]', err);
        return res.status(500).json({ status: 'error', message: err.message });
    }
    }

    async getOrder(req, res) {
    try {
        const user = req.user;
        if (!user || !user.id) return res.status(401).json({ status: 'fail', data: { message: 'Unauthorized' } });

        const ord = await svc.getUserOrder({ userId: user.id, orderId: req.params.id });
        if (!ord) return res.status(404).json({ status: 'fail', data: { message: 'Not found or not authorized' } });
        return res.json({ status: 'success', data: ord });
    } catch (err) {
        console.error('[orders.getOrder]', err);
        return res.status(500).json({ status: 'error', message: err.message });
    }
    }

}

module.exports = orderController;