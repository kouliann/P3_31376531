const jwt = require('jsonwebtoken');
require('dotenv').config(); 

function auth(req, res, next) {
  const authHeader = req.get('Authorization');
  
  // 1. Verificar si el encabezado Authorization está presente.
  if (!authHeader) {
 // Si no está presente, devuelve 401 inmediatamente.
   console.log(authHeader)
    return res.status(401).json({ status: 'fail', data: { message: 'No token provided' }});
    }

 // 2. Extraer el token de forma segura, verificando el prefijo 'Bearer'.
 const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  // 3. Verificar si se pudo extraer un token válido (manejando formatos incorrectos).
  if (!token) {
    return res.status(401).json({ status: 'fail', data: { message: 'Invalid token format. Expected: Bearer <token>' }});
  }
  
  const secret = process.env.JWT_SECRET || 'dev_secret';
  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'fail', data: { message: 'Token expired' }});
    }
    // Aquí manejamos cualquier otro error de JWT (firma inválida, etc.)
    console.error('JWT verify error:', err.message);
    return res.status(401).json({ status: 'fail', data: { message: 'Invalid token' }});
  }
}

module.exports = auth;
