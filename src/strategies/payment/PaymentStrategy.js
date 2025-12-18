
const dotenv = require('dotenv');
dotenv.config();

class CreditCardPaymentStrategy {
  // Método que los tests mockean: prototype.processPayment
  async processPayment(amount, details) {
    // Validaciones mínimas
    if (!details) details = {};
    if (!details.cardNumber && !details.card && !details.cardHolder) {
      // Si faltan datos, devolvemos objeto indicando fallo (OrderService/Controller lo manejará)
      return { success: false, message: 'Faltan datos mínimos de pago' };
    }

    // Preparar body de la pasarela
    const body = {
      amount: Number(amount).toString(),
      currency: (details.currency || 'USD'),
      'card-number': details.cardNumber || details.card,
      cvv: details.cvv,
      'expiration-month': details.expMonth,
      'expiration-year': details.expYear,
      'full-name': details.cardHolder || details.cardholder,
      description: 'Compra en la tienda',
      reference: `ref-${Date.now()}`
    };

    // Validar API Key
    if (!process.env.FAKE_PAYMENT_API_KEY) {
      return { success: false, message: 'FAKE_PAYMENT_API_KEY no configurada' };
    }

    try {
      const resp = await fetch('https://fakepayment.onrender.com/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FAKE_PAYMENT_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      // Log útil para debugging
      console.log('Payment API status', resp.status, resp.statusText);

      let parsed;
      try {
        parsed = await resp.json();
      } catch (err) {
        const text = await resp.text();
        return { success: false, message: `Respuesta no-JSON de la pasarela: ${text}` };
      }

      if (!resp.ok || !parsed.success) {
        return { success: false, message: parsed && parsed.message, errors: parsed && parsed.errors };
      }

      return { success: true, providerPaymentId: parsed.data.transaction_id, raw: parsed };

    } catch (err) {
      // Detectar timeout o problemas de red
      if (err && err.code === 'ETIMEDOUT') {
        return { success: false, message: String(err.message || 'timeout'), isTimeout: true };
      }
      console.error('Error procesando pago:', err && err.message);
      return { success: false, message: String(err && err.message || 'Error en pasarela') };
    }
  }

  // Compatibilidad: execute delega a processPayment
  async execute(amount, details) {
    return this.processPayment(amount, details);
  }

  // Método estático que usa el PaymentContext para despachar por nombre de método
  static async process(methodName, amount, details) {
    if (!CreditCardPaymentStrategy._paymentContext) {
      throw new Error('PaymentContext no inicializado');
    }

    const res = await CreditCardPaymentStrategy._paymentContext.process(methodName, amount, details);

    if (res && res.success === false) {
      const err = new Error(res.message || 'Pago rechazado por la pasarela');
      if (res.isTimeout) err.isTimeout = true;
      err.payment = res;
      throw err;
    }

    return res;
  }
}

class PaymentContext {
  constructor() {
    this.strategies = {
      CreditCard: new CreditCardPaymentStrategy()
    };
  }

  async process(methodName, amount, details) {
    const m = (methodName || '').toString().toLowerCase().replace(/[^a-z]/g, '');
    // buscar estrategia por clave normalizada (case-insensitive, acepta 'creditcard', 'credit-card', etc.)
    const entry = Object.entries(this.strategies).find(([k]) => k.toLowerCase().replace(/[^a-z]/g, '') === m);
    const strategy = entry ? entry[1] : undefined;
    if (!strategy) throw new Error(`El método de pago '${methodName}' no es válido o no está soportado.`);
    return strategy.execute(amount, details);
  }
}

const paymentContext = new PaymentContext();
CreditCardPaymentStrategy._paymentContext = paymentContext;

module.exports = CreditCardPaymentStrategy;