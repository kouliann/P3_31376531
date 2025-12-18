var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var swaggerJSDoc = require('swagger-jsdoc');
var swaggerUI = require('swagger-ui-express');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var usuariosRouter = require('./src/routes/userRouters');
var albumsRouter = require('./src/routes/AlbumsRoutes');
var categoryRouter = require('./src/routes/categoryRoutes');
var tagsRouter = require('./src/routes/tagsRoutes');
const ordersRouter = require('./src/routes/ordersRoutes');

const cors = require('cors');

var app = express();

app.use(cors()); 
app.options('*', cors());

// Swagger / OpenAPI definition
 const swaggerOptions = {

  swaggerOptions: {
    url: "/api-docs/swagger.json", // Usa una ruta relativa en lugar de absoluta
  },

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
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            albumId: { type: 'integer', example: 7 },
            quantity: { type: 'integer', example: 2 },
            unitPrice: { type: 'number', example: 19.99 }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 123 },
            userId: { type: 'string', example: 'uuid-or-id' },
            totalAmount: { type: 'number', example: 59.97 },
            status: { type: 'string', example: 'COMPLETED' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } }
          }
        },
        OrderRequest: {
          type: 'object',
          required: ['items','paymentMethod','paymentDetails'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['albumId','quantity'],
                properties: {
                  albumId: { type: 'integer', example: 7 },
                  quantity: { type: 'integer', example: 2 }
                }
              }
            },
            paymentMethod: { type: 'string', example: 'creditcard' },
            paymentDetails: { type: 'object', example: { cardNumber: '4111111111111111', cvv: '123', expiryMonth: '12', expiryYear: '2030' } },
            currency: { type: 'string', example: 'USD' }
          }
        },
      }
    }
  },
  apis: [path.join(__dirname, 'app.js')]
};

let swaggerSpec;
try {
  swaggerSpec = swaggerJSDoc(swaggerOptions);
  // servir el JSON del spec en una ruta fija
  app.get('/api-docs/swagger.json', (req, res) => res.json(swaggerSpec));

  // montar UI y forzar que cargue el JSON vía HTTP (evita problemas de scheme/CORS)
  app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(null, swaggerOptions));
  console.log('Swagger UI montado en /api-docs (spec en /api-docs/swagger.json)');
} catch (err) {
  console.error('[swagger] error generando spec:', err && err.message);
  console.warn('Swagger UI no estará disponible hasta corregir la spec');
}



// Expose swagger UI at /api-docs

const CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.1.0/swagger-ui.min.css";
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec , { customCssUrl: CSS_URL }));

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

// RUTAS DE USUARIOS Y ALBUMS


app.use('/users', usuariosRouter);
app.use('/albums', albumsRouter);
app.use('/categories', categoryRouter);
app.use('/tags', tagsRouter);
app.use('/orders', ordersRouter);


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
 *     summary: Lista todos los usuarios
 *     description: Devuelve la lista de usuarios (protegido). Respuesta JSend.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersListResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   post:
 *     tags:
 *       - Usuarios
 *     summary: Crea un nuevo usuario
 *     description: Crea un usuario y devuelve sus datos (sin passwordHash).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegistration'
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationSuccess'
 *       409:
 *         $ref: '#/components/schemas/ErrorResponse'
 */


/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags:
 *       - Usuarios
 *     summary: Obtener usuario por id
 *     description: Devuelve los datos públicos de un usuario por su id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Id del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationSuccess'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     tags:
 *       - Usuarios
 *     summary: Actualiza un usuario
 *     description: Actualiza datos de usuario (protegido).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombreCompleto:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationSuccess'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   delete:
 *     tags:
 *       - Usuarios
 *     summary: Elimina un usuario
 *     description: Elimina un usuario por id (protegido).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */


// --- DOCUMENTACION DEL RECURSO /ALBUMS, /CATEGORIES Y /TAGS

// ALBUMS
/**
 * @openapi
 * /albums:
 *   get:
 *     tags:
 *       - Public - Products
 *     summary: Listado público avanzado de albums (paginación y filtros)
 *     description: >
 *       Endpoint público para listar y filtrar albums. Devuelve resultado en formato JSend.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Elementos por página (máx. 100)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: ID numérico o nombre de la categoría
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: CSV de IDs o nombres de tags (ej. "1,2" o "rock,indie")
 *       - in: query
 *         name: price_min
 *         schema:
 *           type: number
 *         description: Precio mínimo (inclusive)
 *       - in: query
 *         name: price_max
 *         schema:
 *           type: number
 *         description: Precio máximo (inclusive)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Término de búsqueda aplicado a name y description
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filtrar por author
 *       - in: query
 *         name: discography
 *         schema:
 *           type: string
 *         description: Filtrar por discography / sello
 *       - in: query
 *         name: deluxeVersion
 *         schema:
 *           type: boolean
 *         description: Filtrar por versión deluxe (true/false)
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *         description: Orden (ej. "price:asc" o "createdAt:desc")
 *     responses:
 *       200:
 *         description: Listado paginado (JSend)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                     meta:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   post:
 *     tags:
 *       - Admin - Products
 *     summary: Crear un album (protegido)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *               author:
 *                 type: string
 *               discography:
 *                 type: string
 *               deluxeVersion:
 *                 type: boolean
 *               category:
 *                 type: string
 *                 description: Nombre de categoría (o usar categoryId)
 *               categoryId:
 *                 type: integer
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Album creado
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /albums/{idSlug}:
 *   get:
 *     tags:
 *       - Public - Products
 *     summary: Vista pública de album por id-slug (Self-Healing)
 *     description: >
 *       Ruta pública que acepta formato "{id}-{slug}" o solo "{id}". Busca por id y si el slug
 *       de la URL no coincide redirige 301 a la URL canónica.
 *     parameters:
 *       - in: path
 *         name: idSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Formato "123-mi-album" o "123"
 *     responses:
 *       200:
 *         description: Album encontrado (JSend success)
 *       301:
 *         description: Redirección permanente a la URL canónica (Location header)
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /albums/{id}:
 *   put:
 *     tags:
 *       - Admin - Products
 *     summary: Actualizar album (protegido)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Album actualizado
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   delete:
 *     tags:
 *       - Admin - Products
 *     summary: Eliminar album (protegido)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Album eliminado
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

// CATEGORIES

/**
 * @openapi
 * /categories:
 *   post:
 *     tags:
 *       - Admin - Categories
 *     summary: Crear categoría (protegido)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Categoría creada
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     tags:
 *       - Admin - Categories
 *     summary: Actualizar categoría (protegido)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   delete:
 *     tags:
 *       - Admin - Categories
 *     summary: Eliminar categoría (protegido)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Categoría eliminada
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

// TAGS
/**
 * @openapi
 * /tags:
 *   post:
 *     tags:
 *       - Admin - Tags
 *     summary: Crear tag (protegido)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tag creado
 *       400:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     tags:
 *       - Admin - Tags
 *     summary: Actualizar tag (protegido)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag actualizado
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   delete:
 *     tags:
 *       - Admin - Tags
 *     summary: Eliminar tag (protegido)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag eliminado
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 */

// get /about - respuesta en json con nombre completo, cédula y sección

/**
 * @openapi
 * /orders:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Crea una orden y procesa el pago (OPERACIÓN TRANSACCIONAL)
 *     security:
 *      - BearerAuth: []
 *     description: >
 *       Operación transaccional: se crea la orden en estado PENDING, se registran los items y se decrementa
 *       el stock. Si el pago falla se realiza un rollback completo (stock restaurado y orden eliminada).
 *       Requiere `paymentMethod` y `paymentDetails` en el body.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderRequest'
 *     responses:
 *       201:
 *         description: Orden creada y pagada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Error de validación o pago rechazado
 *         content:
 *           application/json:
 *             $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 *   get:
 *     tags:
 *       - Orders
 *     summary: Lista las órdenes del usuario autenticado
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página de resultados
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Tamaño de página
 *     responses:
 *       200:
 *         description: Listado paginado de órdenes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 *                     meta:
 *                       type: object
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *
 */

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Obtiene una orden por id (usuario debe ser propietario)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orden encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/schemas/ErrorResponse'
 * */

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
