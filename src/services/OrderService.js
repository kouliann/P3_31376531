
const getPrisma = require('../db/prismaClient');
const prisma = getPrisma();
const PaymentProcessor = require('../strategies/payment/PaymentStrategy');

class OrderService {
  
  async createOrder(userId, items, paymentDetails) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('El carrito de compras no puede estar vacío');
    }
    // Primera fase: validación y cálculo del total fuera de la transacción
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const albumId = item.albumId ?? item.id;
      if (!albumId) throw new Error('Cada item debe incluir albumId');

      const album = await prisma.albums.findUnique({ where: { id: Number(albumId) } });
      if (!album) {
        throw new Error(`Album con ID ${albumId} no encontrado.`);
      }

      if (album.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${album.name}. Disponible: ${album.stock}`);
      }

      const itemTotal = Number(album.price) * item.quantity;
      totalAmount += itemTotal;

      orderItemsData.push({
        albumId: album.id,
        quantity: item.quantity,
        unitPrice: album.price
      });
    }

    // INTEGRACIÓN DE PAGO: fuera de la transacción para no bloquear DB durante la llamada HTTP
    const methodToUse = paymentDetails?.method || paymentDetails?.paymentMethod || 'CreditCard';
    if (!methodToUse) throw new Error("Debe especificar un 'paymentMethod' (ej. CreditCard).");

    console.log(`Intentando pagar con: ${methodToUse} por monto ${totalAmount}`);

    let paymentResult;
    try {
      paymentResult = await PaymentProcessor.process(methodToUse, totalAmount, paymentDetails);
      console.log('Payment result:', paymentResult);
    } catch (err) {
      console.error('Payment processing error:', err && err.message, 'isTimeout=', !!(err && err.isTimeout));
      throw err;
    }

    if (!paymentResult || paymentResult.success === false) {
      const err = new Error(paymentResult && paymentResult.message ? paymentResult.message : 'Pago rechazado');
      if (paymentResult && paymentResult.isTimeout) err.isTimeout = true;
      err.payment = paymentResult;
      throw err;
    }

    // Segunda fase: realizar cambios en DB dentro de la transacción (re-verificar stock y crear registros)
    return await prisma.$transaction(async (tx) => {
      // Re-verificar stock dentro de la transacción para evitar condiciones de carrera
      for (const it of orderItemsData) {
        const album = await tx.albums.findUnique({ where: { id: it.albumId } });
        if (!album) throw new Error(`Album con ID ${it.albumId} no encontrado durante commit.`);
        if (album.stock < it.quantity) throw new Error(`Stock insuficiente para ${album.name} durante commit. Disponible: ${album.stock}`);
      }

      // Descontar Stock
      for (const it of orderItemsData) {
        await tx.albums.update({
          where: { id: it.albumId },
          data: { stock: { decrement: it.quantity } }
        });
      }

      // Crear la Orden
      const newOrder = await tx.order.create({
        data: {
          userId: String(userId),
          totalAmount: totalAmount,
          status: 'COMPLETED'
        }
      });

      // Crear los Detalles (Items)
      const itemsWithOrderId = orderItemsData.map(item => ({ ...item, orderId: newOrder.id }));
      if (itemsWithOrderId.length) {
        await tx.orderItem.createMany({ data: itemsWithOrderId });
      }

      // Registrar pago
      try {
        await tx.payment.create({
          data: {
            orderId: newOrder.id,
            provider: methodToUse,
            providerPaymentId: paymentResult.providerPaymentId || null,
            amount: totalAmount,
            status: 'SUCCESS',
            rawResponse: JSON.stringify(paymentResult.raw || paymentResult)
          }
        });
      } catch (e) {
        console.error('Error creando registro de pago en DB:', e && e.message);
      }

      return await tx.order.findUnique({ where: { id: newOrder.id }, include: { items: true, Payment: true } });
    }, { maxWait: 7000, timeout: 40000 });
  }

  // Obtener historial del usuario
  async getUserOrders(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const where = { userId: String(userId) };
    const [count, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { items: { include: { album: true } } },
        skip: offset,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      })
    ]);
    return { count, rows };
  }

  // Detalle de orden
  async getOrderDetail(orderId, userId) {
    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId: String(userId) },
      include: { items: { include: { album: true } } }
    });
    return order;
  }
}

module.exports = new OrderService();