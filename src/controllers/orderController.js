// src/controllers/order.controller.js
const OrderService = require('../services/OrderService');
const dotenv = require('dotenv');
dotenv.config();
require('../../middleware/auth')

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
        // Aceptamos distintas claves que las pruebas usan: 'card', 'cardNumber' o 'cardHolder'.
        if (!paymentDetails || (!paymentDetails.cardNumber && !paymentDetails.card && !paymentDetails.cardHolder)) {
          return res.status(400).json({ 
            status: 'fail', 
            data: { message: 'Faltan detalles mínimos del pago (card, cardNumber o cardHolder)' } 
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
      // Manejo de errores: timeout de pasarela debe retornar 504
      console.error("Error al crear orden:", error && error.message);
      console.error(error && error.stack);

      // Timeout en la pasarela -> 504 (puede venir como error.isTimeout o en error.payment.isTimeout)
      if (error && (error.isTimeout || (error.payment && error.payment.isTimeout))) {
        const payment = error.payment || (error && error.payment) || null;
        return res.status(504).json({
          status: 'fail',
          data: {
            reason: (payment && payment.message) || error.message || 'timeout',
            payment: payment || null
          }
        });
      }

      // Rechazo de pago o errores de negocio -> 400
      if (error && error.payment) {
        return res.status(400).json({
          status: 'fail',
          data: {
            message: error.message || 'Pago rechazado',
            payment: error.payment
          }
        });
      }

      // Otras validaciones u errores -> 400
      return res.status(400).json({ 
        status: 'fail', 
        data: { message: error.message || 'Error al crear orden' } 
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