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
      description: 'Documentación de los endpoints /ping y /about'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local server' }
    ]
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

// get /about - respuesta en json con nombre completo, cédula y sección

/**
 * @openapi
 * /about:
 *   get:
 *     summary: Devuelve información del autor en formato JSend
 *     description: Responde con un objeto JSend cuyo campo `data` contiene nombreCompleto, cedula y seccion.
 *     responses:
 *       200:
 *         description: Respuesta exitosa en formato JSend
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
 *                     nombreCompleto:
 *                       type: string
 *                       example: Eliannibeth De Jesus Padrino Bello
 *                     cedula:
 *                       type: string
 *                       example: 31.376.531
 *                     seccion:
 *                       type: string
 *                       example: "2"
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
 *   get:
 *     summary: Health check que responde 200 OK sin contenido
 *     responses:
 *       200:
 *         description: OK (sin contenido)
 */

app.get('/ping', function(req, res) {
  res.status(200).end();
});

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

module.exports = app;
