var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var swaggerJSDoc = require('swagger-jsdoc');
var swaggerUi = require('swagger-ui-express');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');


var app = express();

// Swagger / OpenAPI definition
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Proyecto API',
      version: '1.0.0',
      description: 'Documentación de los endpoints /ping, /about, Autenticación y /users (protegido).' // Descripción actualizada
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local server' }
    ],
    components: { // Nuevos componentes para modelos y seguridad
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Introduce el token JWT con el prefijo "Bearer "'
        }
      },
      schemas: {
        // --- DTOs de Solicitud ---
        UserRegistration: {
          type: 'object',
          required: ['nombreCompleto', 'email', 'password'],
          properties: {
            nombreCompleto: { type: 'string', example: 'Juan Perez' },
            email: { type: 'string', format: 'email', example: 'juan.perez@example.com' },
            password: { type: 'string', format: 'password', example: 'SecureP@ss123!' }
          }
        },
        UserCredentials: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'juan.perez@example.com' },
            password: { type: 'string', format: 'password', example: 'SecureP@ss123!' }
          }
        },
        // --- DTOs de Respuesta ---
        UserResponseData: {
          type: 'object',
          properties: {
            id: { type: 'integer', readOnly: true, example: 123 },
            nombreCompleto: { type: 'string', example: 'Juan Perez' },
            email: { type: 'string', format: 'email', example: 'juan.perez@example.com' },
            // Nota: passwordHash no se devuelve por seguridad.
          }
        },
        TokenResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                user: { $ref: '#/components/schemas/UserResponseData' }
              }
            }
          }
        },
        // --- Respuestas JSend Genéricas ---
        RegistrationSuccess: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: { $ref: '#/components/schemas/UserResponseData' }
          }
        },
        UsersListResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/UserResponseData' }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'fail' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Invalid credentials' }
              }
            }
          }
        },
      }
    }
  },
  apis: [path.join(__dirname, 'app.js')]
});

// Expose swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

/////////////////// INICIO ENDPOINTS ///////////////////////

// --- DOCUMENTACIÓN DE AUTENTICACIÓN ---

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Autenticación
 *     summary: Registra un nuevo usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegistration'
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente (devuelve datos sin hash)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationSuccess'
 *       409:
 *         description: Conflicto - Email ya está en uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Autenticación
 *     summary: Inicia sesión y devuelve un token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCredentials'
 *     responses:
 *       200:
 *         description: Login exitoso. Devuelve el token JWT y los datos del usuario.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// --- DOCUMENTACIÓN DE RECURSO /USERS 

/**
 * @openapi
 * /users:
 *   get:
 *     tags:
 *       - Usuarios
 *     summary: Obtiene la lista de todos los usuarios
 *     description: Esta ruta está protegida y requiere un token JWT válido.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersListResponse'
 *       401:
 *         description: No autorizado (Token faltante o inválido/expirado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// get /about - respuesta en json con nombre completo, cédula y sección

/**
 * @openapi
 * /about:
 *    get:
 *      tags:
 *        - Información
 *      summary: Devuelve información del autor en formato JSend
 *      description: Responde con un objeto JSend cuyo campo `data` contiene nombreCompleto, cedula y seccion.
 *      responses:
 *        200:
 *         description: Respuesta exitosa en formato JSend
 *         content:
 *           application/json:
 *             schema:
 *                 type: object
 *                 properties:
 *                    status:
 *                      type: string
 *                      example: success
 *                    data:
 *                      type: object
 *                      properties:
 *                        nombreCompleto:
 *                          type: string
 *                          example: Eliannibeth De Jesus Padrino Bello
 *                        cedula:
 *                          type: string
 *                          example: 31.376.531
 *                        seccion:
 *                          type: string
 *                          example: "2"
 */

app.get('/about' , function(req, res) {
  res.json({
    status: 'success',
    data:{
      nombreCompleto: 'Eliannibeth De Jesus Padrino Bello',
      cedula:'31.376.531',
      seccion:'2'
    }
  });
});

//get /ping - respuesta con estatus 200 y sin contenido

/**
 * @openapi
 * /ping:
 *    get:
 *      tags:
 *        - Utilidades
 *      summary: Health check que responde 200 OK sin contenido
 *      responses:
 *        200:
 *          description: OK (sin contenido)
 */

app.get('/ping', function(req, res) {
  res.status(200).end();
});


/////////////////// FIN ENDPOINTS ///////////////////////




// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log('app activa');
module.exports = app;
