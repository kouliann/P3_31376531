// src/strategies/payment.strategy.js
const dotenv = require('dotenv');
dotenv.config();

/**
 * ESTRATEGIA CONCRETA: Tarjeta de Crédito
 * Implementa la lógica específica para la API FakePayment
 */
class CreditCardStrategy {
  async execute(amount, details) {
    // 1. Validamos datos mínimos
    if (!details.cardNumber || !details.cardHolder) {
        throw new Error("Faltan datos de la tarjeta (número o titular) para procesar el pago.");
    }

    // 2. Preparamos el cuerpo de la petición (Mapeo de datos)
    const body = {
      amount: amount.toString(),
      currency: "USD",
      "card-number": details.cardNumber,
      "cvv": details.cvv,
      "expiration-month": details.expMonth,
      "expiration-year": details.expYear,
      "full-name": details.cardHolder,
      "description": "Compra en Tienda de Repuestos Joan´s Fix", // Campo OBLIGATORIO para evitar error 400
      "reference": `ref-${Date.now()}`
    };

    console.log("--> Procesando pago con CreditCardStrategy...");

    // 3. Validar que exista la API KEY antes de llamar a la pasarela
    if (!process.env.FAKE_PAYMENT_API_KEY) {
      throw new Error('FAKE_PAYMENT_API_KEY no configurada en las variables de entorno');
    }

    // 4. Conexión con la API externa
    const response = await fetch('https://fakepayment.onrender.com/payments', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FAKE_PAYMENT_API_KEY}` 
      },
      body: JSON.stringify(body)
    });

    console.log("Payment API response status:", response.status, response.statusText);

    // 5. Intentamos parsear JSON, si la respuesta no es JSON la leemos como texto y reportamos claramente
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const textBody = await response.text();
      console.error('Payment API returned non-JSON response:', textBody);
      throw new Error(`Pago rechazado por la pasarela (${response.status} ${response.statusText}): ${textBody}`);
    }

    // 4. Manejo de errores de la pasarela
    if (!response.ok || !data.success) {
      if (data && data.errors) console.error("Detalle Error API:", JSON.stringify(data.errors, null, 2));
      throw new Error(data && data.message ? data.message : `Pago rechazado por la pasarela (${response.status} ${response.statusText})`);
    }

    // 5. Retorno exitoso estandarizado
    return {
      success: true,
      transactionId: data.data.transaction_id
    };
  }
}

/**
 * CONTEXTO (PaymentProcessor)
 * Actúa como despachador. Si en el futuro agregas PayPal, solo lo registras aquí.
 */
class PaymentContext {
  constructor() {
    this.strategies = {
      'CreditCard': new CreditCardStrategy()
      
    };
  }

  /**
   * Selecciona y ejecuta la estrategia según el nombre del método.
   */
  async process(methodName, amount, details) {
    const strategy = this.strategies[methodName];
    
    if (!strategy) {
      throw new Error(`El método de pago '${methodName}' no es válido o no está soportado.`);
    }

    return await strategy.execute(amount, details);
  }
}

module.exports = new PaymentContext();