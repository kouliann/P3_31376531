
const getPrisma = require('../db/prismaClient');
const prisma = getPrisma();
const PaymentProcessor = require('../strategies/payment/PaymentStrategy');

class OrderService {
  
  async createOrder(userId, items, paymentDetails) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('El carrito de compras no puede estar vacío');
    }

    // Usamos transacción interactivamente con Prisma
    return await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData = [];

      // 2. VERIFICACIÓN DE STOCK Y CÁLCULO DE TOTAL
      for (const item of items) {
        // Aceptamos ambas formas: albumId o id (compatibilidad)
        const albumId = item.albumId ?? item.id;
        if (!albumId) throw new Error('Cada item debe incluir albumId');

        const album = await tx.albums.findUnique({ where: { id: Number(albumId) } });
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

// 3. INTEGRACIÓN DE PAGO (Patrón Strategy Dinámico)
      
      // A. Identificamos qué método quiere usar el usuario (ej. "CreditCard", "Bitcoin")
      // Si no envía nada, asumimos 'CreditCard' por defecto (opcional)
      const methodToUse = paymentDetails?.method || paymentDetails?.paymentMethod || 'CreditCard';

      if (!methodToUse) {
        throw new Error("Debe especificar un 'paymentMethod' (ej. CreditCard).");
      }

      console.log(`Intentando pagar con: ${methodToUse}`);

      // B. Delegamos al Contexto la ejecución
      // Esto lanzará error si methodToUse es "Bitcoin" porque no existe en el mapa
      let paymentResult;
      try {
        paymentResult = await PaymentProcessor.process(methodToUse, totalAmount, paymentDetails);
        console.log('Payment result:', paymentResult);
      } catch (err) {
        // Log y re-lanzamos para que el controller pueda mapear a 504/400 según corresponda
        console.error('Payment processing error:', err && err.message, 'isTimeout=', !!(err && err.isTimeout));
        throw err;
      }

      // Si por algún motivo la estrategia devolviera un objeto indicando fallo (sin lanzar), lo normalizamos aquí
      if (!paymentResult || paymentResult.success === false) {
        const err = new Error(paymentResult && paymentResult.message ? paymentResult.message : 'Pago rechazado');
        if (paymentResult && paymentResult.isTimeout) err.isTimeout = true;
        err.payment = paymentResult;
        throw err;
      }

      // 4. ACTUALIZACIÓN DE STOCK Y CREACIÓN DE REGISTROS
      
      // A. Descontar Stock
      for (const it of orderItemsData) {
        await tx.albums.update({
          where: { id: it.albumId },
          data: { stock: { decrement: it.quantity } }
        });
      }

      // B. Crear la Orden
      const newOrder = await tx.order.create({
        data: {
          userId: String(userId),
          totalAmount: totalAmount,
          status: 'COMPLETED'
        }
      });

      // C. Crear los Detalles (Items)
      const itemsWithOrderId = orderItemsData.map(item => ({
        ...item,
        orderId: newOrder.id
      }));
      
      if (itemsWithOrderId.length) {
        await tx.orderItem.createMany({ data: itemsWithOrderId });
      }

      // D. Registrar pago
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
        // no abort: prefer not to block order creation if logging payment fails
      }

      // 5. CONFIRMAR TRANSACCIÓN (COMMIT)
      // Devolvemos la orden con sus items y pagos
      return await tx.order.findUnique({ where: { id: newOrder.id }, include: { items: true, Payment: true } });

    },
    {
      maxWait: 7000, 
      timeout: 40000 
    }
  
  );
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