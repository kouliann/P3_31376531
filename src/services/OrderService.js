const getPrisma = require('../db/prismaClient');
const prisma = getPrisma();
const CreditCardPaymentStrategy = require('../strategies/payment/CreditCardPaymentStrategy');

class OrderService {
  constructor({ paymentStrategyFactory = null, paymentOptions = {} } = {}) {
    this.paymentStrategyFactory = paymentStrategyFactory;
    this.paymentOptions = paymentOptions;
  }

  _getStrategy(paymentMethod) {
    if (typeof this.paymentStrategyFactory === 'function') {
      const inst = this.paymentStrategyFactory(paymentMethod, this.paymentOptions);
      if (inst) return inst;
    }
    // mapping simple
    const m = (paymentMethod || '').toString().toLowerCase();
    if (m === 'creditcard' || m === 'credit-card' || m === 'card') {
      return new CreditCardPaymentStrategy(this.paymentOptions);
    }
    // fallback to credit card strategy as default
    return new CreditCardPaymentStrategy(this.paymentOptions);
  }

  /**
   * Crea orden: reserva stock y crea order PENDING, luego procesa pago; confirma/compensa según resultado.
   */
  async createAndPay({ userId, items = [], paymentMethod, paymentDetails = {}, currency = 'USD' }) {
    if (!userId) throw new Error('userId requerido');
    if (!Array.isArray(items) || items.length === 0) throw new Error('items son requeridos');

    // 1) Validaciones y cálculo total
    const albumIds = [...new Set(items.map(i => Number(i.albumId)))];
    const albums = await prisma.albums.findMany({ where: { id: { in: albumIds } } });
    const albumMap = new Map(albums.map(a => [a.id, a]));

    for (const it of items) {
      const album = albumMap.get(Number(it.albumId));
      if (!album) throw new Error(`Album ${it.albumId} no encontrado`);
      if (album.stock < Number(it.quantity)) throw new Error(`Stock insuficiente para album ${album.id}`);
    }

    let totalAmount = 0;
    const normalizedItems = items.map(it => {
      const album = albumMap.get(Number(it.albumId));
      const q = Number(it.quantity);
      const unitPrice = Number(album.price);
      totalAmount += unitPrice * q;
      return { albumId: Number(it.albumId), quantity: q, unitPrice };
    });

    // 2) Reserva en BD: crear order PENDING + orderItems + decrementar stock (transacción)
    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: { userId: String(userId), totalAmount, status: 'PENDING' }
      });

      for (const it of normalizedItems) {
        await tx.orderItem.create({
          data: { orderId: order.id, albumId: it.albumId, quantity: it.quantity, unitPrice: it.unitPrice }
        });
        await tx.albums.update({
          where: { id: it.albumId },
          data: { stock: { decrement: it.quantity } }
        });
      }

      return order;
    });

    // 3) Ejecutar el pago (fuera de la transacción)
    const strategy = this._getStrategy(paymentMethod);
    const paymentResult = await strategy.processPayment({ amount: totalAmount, currency, paymentMethod, paymentDetails });

if (!paymentResult || !paymentResult.success) {
  // Pago falló -> compensación estricta: restaurar stock y eliminar la orden creada (no dejamos rastro)
  try {
    await prisma.$transaction(async (tx) => {
      // Restaurar stock
      for (const it of normalizedItems) {
        await tx.albums.update({
          where: { id: it.albumId },
          data: { stock: { increment: it.quantity } }
        });
      }

      // Borrar items de la orden
      await tx.orderItem.deleteMany({ where: { orderId: createdOrder.id } });

      // Borrar la orden
      await tx.order.delete({ where: { id: createdOrder.id } });
    });

    return { success: false, reason: paymentResult.message || 'payment_failed', payment: paymentResult, orderId: null };
  } catch (compErr) {
    // Si falla la compensación, logueamos y devolvemos información para investigarlo
    console.error('[OrderService] Compensación fallida después de payment failure:', compErr);
    // Intentamos marcar la orden como PAYMENT_FAILED como fallback
    try {
      await prisma.order.update({ where: { id: createdOrder.id }, data: { status: 'PAYMENT_FAILED' } });
      await prisma.payment.create({
        data: {
          orderId: createdOrder.id,
          provider: (strategy && strategy.providerName) || 'unknown',
          providerPaymentId: paymentResult && paymentResult.providerPaymentId ? paymentResult.providerPaymentId : null,
          amount: totalAmount,
          status: 'FAILED',
          rawResponse: JSON.stringify(paymentResult.raw || {})
        }
      });
    } catch (fallbackErr) {
      console.error('[OrderService] Fallback marking failed:', fallbackErr);
    }

    return { success: false, reason: 'compensation_failed', payment: paymentResult, orderId: createdOrder.id };
  }
}

    // 4b) Pago OK -> confirmar en BD: marcar COMPLETED y guardar payment (transacción)
    const finalOrder = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: createdOrder.id,
          provider: strategy.providerName || 'unknown',
          providerPaymentId: paymentResult.providerPaymentId || null,
          amount: totalAmount,
          status: 'SUCCESS',
          rawResponse: JSON.stringify(paymentResult.raw || {})
        }
      });

      await tx.order.update({ where: { id: createdOrder.id }, data: { status: 'COMPLETED' } });

      return tx.order.findUnique({
        where: { id: createdOrder.id },
        include: { items: { include: { album: true } }, Payment: true, user: true }
      });
    });

    return { success: true, order: finalOrder, payment: paymentResult };
  }

  async listUserOrders({ userId, page = 1, limit = 10 }) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (p - 1) * l;

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: String(userId) },
        include: { items: { include: { album: true } }, Payment: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l
      }),
      prisma.order.count({ where: { userId: String(userId) } })
    ]);

    return { items, meta: { page: p, limit: l, total, totalPages: Math.ceil(total / l) || 1 } };
  }

  async getUserOrder({ userId, orderId }) {
    const ord = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: { items: { include: { album: true } }, Payment: true, user: true }
    });
    if (!ord) return null;
    if (String(ord.userId) !== String(userId)) return null;
    return ord;
  }
}

module.exports = OrderService;