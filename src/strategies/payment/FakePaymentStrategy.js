const axios = require('axios');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class FakePaymentStrategy {
  constructor(opts = {}) {
    this.endpoint = opts.endpoint || process.env.PAYMENT_ENDPOINT || 'https://fakepayment.onrender.com/payments';
    this.timeout = typeof opts.timeout === 'number' ? opts.timeout : (process.env.PAYMENT_TIMEOUT ? Number(process.env.PAYMENT_TIMEOUT) : 15000);
    this.retryCount = Number.isInteger(opts.retryCount) ? opts.retryCount : (process.env.PAYMENT_RETRY ? Number(process.env.PAYMENT_RETRY) : 2);
    this.retryDelay = typeof opts.retryDelay === 'number' ? opts.retryDelay : 300;
    this.providerName = opts.providerName || process.env.PAYMENT_PROVIDER || 'fakepayment';

    // Permitir pasar apiKey o headers en opts; si no, intentar leer de env PAYMENT_API_KEY
    this.apiKey = opts.apiKey || process.env.PAYMENT_API_KEY || null;
    this.extraHeaders = opts.headers || {};
  }

  _buildHeaders() {
    const headers = Object.assign({}, this.extraHeaders);
    // Si hay apiKey, añadimos Authorization Bearer por compatibilidad (puedes cambiar a 'x-api-key')
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    headers['Content-Type'] = 'application/json';
    return headers;
  }

  async pay(paymentPayload) {
    const body = {
      amount: paymentPayload.amount,
      currency: paymentPayload.currency || 'USD',
      paymentMethod: paymentPayload.paymentMethod || 'unknown',
      paymentDetails: paymentPayload.paymentDetails || {}
    };

    let attempt = 0;
    let lastErr = null;

    while (attempt <= this.retryCount) {
      try {
        attempt++;
        console.debug('[FakePaymentStrategy] POST ->', this.endpoint, 'headers:', this._buildHeaders(), 'body:', JSON.stringify(body));
        const res = await axios.post(this.endpoint, body, {
          timeout: this.timeout,
          headers: this._buildHeaders()
        });

        const data = res && res.data ? res.data : null;
        const success = (data && (data.success === true || data.status === 'success')) || res.status === 200;
        const providerPaymentId = data && (data.id || data.paymentId || data.transactionId)
          ? (data.id || data.paymentId || data.transactionId)
          : `fp_${Date.now()}`;

        return {
          success,
          providerPaymentId,
          raw: data || { status: res.status, statusText: res.statusText },
          message: success ? 'OK' : (data && data.message ? data.message : 'Payment rejected')
        };
      } catch (err) {
        lastErr = err;
        const isTimeout = err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'));
        const status = err.response && err.response.status;
        const isServerError = status && status >= 500 && status < 600;
        const isNetwork = !err.response;

        // Si respuesta 401/403 (no autorizado) -> no reintentar, devolver inmediatamente para depuración
        if (status === 401 || status === 403) {
          const raw = err.response ? (err.response.data || err.response.statusText) : { message: err.message };
          console.error('[FakePaymentStrategy] Unauthorized response from payment provider:', raw);
          return {
            success: false,
            providerPaymentId: null,
            raw,
            message: `Unauthorized (status ${status})`
          };
        }

        if (attempt > this.retryCount || (!isTimeout && !isServerError && !isNetwork)) {
          const raw = err.response ? (err.response.data || err.response.statusText) : { message: err.message };
          console.error(`[FakePaymentStrategy] Final failure (attempt ${attempt}):`, raw);
          return {
            success: false,
            providerPaymentId: null,
            raw,
            message: err.message || 'Payment error'
          };
        }

        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.warn(`[FakePaymentStrategy] attempt ${attempt} failed: ${err.message || err}; retrying in ${delay}ms`);
        await sleep(delay);
      }
    }

    const raw = lastErr && lastErr.response ? (lastErr.response.data || lastErr.response.statusText) : { message: lastErr ? lastErr.message : 'unknown' };
    return {
      success: false,
      providerPaymentId: null,
      raw,
      message: lastErr ? lastErr.message : 'Payment failed'
    };
  }
}

module.exports = FakePaymentStrategy;