class PaymentStrategy {
  /**
   * processPayment(payload)
   * payload: { amount, currency, paymentMethod, paymentDetails }
   * return: { success: boolean, providerPaymentId?: string, raw?: any, message?: string }
   */
  async processPayment(payload) {
    throw new Error('processPayment() not implemented');
  }
}

module.exports = PaymentStrategy;