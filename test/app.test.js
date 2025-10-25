const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = require('../app');

describe('Endpoints', () => {
const publicUserPayload = {
    nombreCompleto: 'Public Test User',
    email: 'publictest@example.com',
    password: 'PublicSecret123!'
  };
  

  test('GET /ping -> 200 y cuerpo vacío', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.text).toBe('');
  });

  test('GET /about -> 200 y JSend success con datos', async () => {
    const res = await request(app).get('/about');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      status: 'success',
      data: expect.objectContaining({
        nombreCompleto: expect.any(String),
        cedula: expect.any(String),
        seccion: expect.any(String)
      })
    }));
  });

test('POST /auth/register -> 200/201 (registro básico)', async () => {
    // Aseguramos que no exista antes de registrarlo
    await prisma.user.deleteMany({ where: { email: publicUserPayload.email } });
    
    const res = await request(app)
      .post('/auth/register')
      .send(publicUserPayload)
      .set('Accept', 'application/json');

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.status).toBe('success');
  });

  test('POST /auth/login -> 200 (login básico)', async () => {
    // Usa el usuario creado en la prueba anterior (registro básico)
    const res = await request(app)
      .post('/auth/login')
      .send({ email: publicUserPayload.email, password: publicUserPayload.password })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('token');
  });

  // Limpiamos el usuario temporal creado en este bloque
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: publicUserPayload.email } });
  });

});

describe('Autenticación y rutas protegidas', () => {
  const userPayload = {
    nombreCompleto: 'Test User',
    email: 'testuser@example.com',
    password: 'Secret123!'
  };
  let token;
  let createdUserId;

  beforeAll(async () => {
    // asegurar DB de test limpia
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  test('registra un usuario (éxito)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(userPayload)
      .set('Accept', 'application/json');

    expect([200,201]).toContain(res.statusCode);
    expect(res.body).toBeDefined();
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('email', userPayload.email);
    expect(res.body.data).toHaveProperty('id');
    createdUserId = res.body.data.id;
    // no debe devolver passwordHash
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  test('rechaza email duplicado', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(userPayload)
      .set('Accept', 'application/json');

    // espera conflicto (P2002 -> 409) o 400 según manejo
    expect([400,409]).toContain(res.statusCode);
  });

  test('login devuelve token y datos de usuario', async () => {
  const secret = process.env.JWT_SECRET || 'dev_secret';
    const res = await request(app)
      .post('/auth/login')
      .send({ email: userPayload.email, password: userPayload.password })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBeTruthy();
    token = res.body.data.token;

    // verificar token válido y payload contiene email
    const payload = jwt.verify(token, secret);
    expect(payload).toHaveProperty('email', userPayload.email);

    // si el endpoint devuelve user en data, chequear nombre
    if (res.body.data.user) {
      expect(res.body.data.user).toHaveProperty('nombreCompleto', userPayload.nombreCompleto);
    }
  });

  test('deniega el acceso a la ruta protegida sin token', async () => {
    const res = await request(app).get('/users').set('Accept', 'application/json');
    expect(res.statusCode).toBe(401);
  });

  test('permite el acceso a la ruta protegida con token', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('login con contraseña incorrecta es rechazado', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: userPayload.email, password: 'wrongpassword' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(401);
  });
});
