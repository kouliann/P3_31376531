// src/controllers/order.controller.js
const OrderService = require('../services/OrderService');

module.exports = {
  // POST /orders - Crear Orden Transaccional
  async create(req, res) {
    try {
      // req.user viene del middleware de autenticación (JWT)
      // Asegúrate de que tu middleware ponga el 'id' en req.user
      const userId = req.user.id; 
      const { items, paymentMethod, paymentDetails } = req.body;

      // 1. Validaciones básicas de entrada
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
          status: 'fail', 
          data: { message: 'El carrito de compras no puede estar vacío' } 
        });
      }
      
      // Validamos que vengan los datos mínimos de la tarjeta solo para métodos que lo requieran
      const method = paymentMethod || paymentDetails?.method || 'CreditCard';
      if (method.toLowerCase() === 'creditcard' || method.toLowerCase() === 'credit-card') {
        if (!paymentDetails || !paymentDetails.cardNumber || !paymentDetails.cardHolder) {
          return res.status(400).json({ 
            status: 'fail', 
            data: { message: 'Faltan detalles del pago (tarjeta, titular, etc.)' } 
          });
        }
      }
      

      // 2. Llamamos al Servicio (La lógica pesada y la transacción están allá)
      // Combinamos paymentMethod y paymentDetails en un solo objeto para el servicio
      const paymentData = { ...paymentDetails, method: paymentMethod };
      
      const order = await OrderService.createOrder(userId, items, paymentData);

      // 3. Respuesta Exitosa
      return res.status(201).json({ 
        status: 'success', 
        data: { order } 
      });

    } catch (error) {
      // Manejo de errores:
      // Si el error viene de nuestras validaciones (Stock, Pago rechazado), es un 400.
      // Si es un error inesperado de código, sería un 500 (aunque aquí simplificamos).
      console.error("Error al crear orden:", error.message);
      console.error(error.stack);
      
      return res.status(400).json({ 
        status: 'fail', 
        message: error.message 
      });
    }
  },

  // GET /orders - Historial del Usuario
  async getAll(req, res) {
    try {
      // Paginación con valores por defecto
      const { page = 1, limit = 10 } = req.query;
      
      const { count, rows } = await OrderService.getUserOrders(req.user.id, page, limit);

      return res.status(200).json({
        status: 'success',
        data: {
          totalItems: count,
          totalPages: Math.ceil(count / limit),
          currentPage: parseInt(page),
          itemsPerPage: parseInt(limit),
          orders: rows
        }
      });
    } catch (error) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Error al obtener el historial de órdenes' 
      });
    }
  },

  // GET /orders/:id - Detalle de una Orden
  async getOne(req, res) {
    try {
      const orderId = req.params.id;
      const userId = req.user.id;

      const order = await OrderService.getOrderDetail(orderId, userId);
      
      if (!order) {
        return res.status(404).json({ 
          status: 'fail', 
          data: { message: 'Orden no encontrada o no pertenece a este usuario' } 
        });
      }

      return res.status(200).json({ 
        status: 'success', 
        data: { order } 
      });

    } catch (error) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Error al obtener el detalle de la orden' 
      });
    }
  }
};