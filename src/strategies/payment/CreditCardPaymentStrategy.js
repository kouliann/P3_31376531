const PaymentStrategy = require('./PaymentStrategy');
const axios = require('axios');

class CreditCardPaymentStrategy extends PaymentStrategy {
  constructor(opts = {}) {
    super();
    this.endpoint = opts.endpoint || process.env.PAYMENT_ENDPOINT || 'https://fakepayment.onrender.com/payments';
    this.timeout = typeof opts.timeout === 'number' ? opts.timeout : (process.env.PAYMENT_TIMEOUT ? Number(process.env.PAYMENT_TIMEOUT) : 15000);
    this.apiKey = opts.apiKey || process.env.PAYMENT_API_KEY || null;
    this.providerName = opts.providerName || process.env.PAYMENT_PROVIDER || 'fakepayment';
  }

  _buildHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  async processPayment({ amount, currency = 'USD', paymentMethod, paymentDetails = {} }) {
    // Build request body expected by the public API
    const body = {
      amount,
      currency,
      paymentMethod,
      paymentDetails
    };

    try {
      const res = await axios.post(this.endpoint, body, { timeout: this.timeout, headers: this._buildHeaders() });
      const data = res && res.data ? res.data : null;
      const success = (data && (data.success === true || data.status === 'success')) || res.status === 200;
      const providerPaymentId = data && (data.id || data.paymentId || data.transactionId) ? (data.id || data.paymentId || data.transactionId) : `pay_${Date.now()}`;

      return { success, providerPaymentId, raw: data || { status: res.status, statusText: res.statusText }, message: success ? 'OK' : (data && data.message) || 'Payment rejected' };
    } catch (err) {
      const raw = err.response ? (err.response.data || err.response.statusText) : { message: err.message };
      const message = err.message || 'Payment error';
      return { success: false, providerPaymentId: null, raw, message };
    }
  }
}

module.exports = CreditCardPaymentStrategy;