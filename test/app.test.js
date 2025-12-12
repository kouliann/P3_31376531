require('./useTestDb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = require('../app');

// TEST ENDPOINTS

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

// TEST USUARIO (task1)

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
    const payload = jwt.verify(token, process.env.JWT_SECRET);
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

// TEST ALBUMS (task2)


describe('API: categorías, tags, albums (CRUD protegido + lectura pública)', () => {
  const user = { nombreCompleto: 'Tester', email: 'tester@example.com', password: 'Secret123!' };
  let token;
  let category;
  let tag;
  let album;

  beforeAll(async () => {
    // limpiar DB
    await prisma.albums.deleteMany().catch(()=>{});
    await prisma.tag.deleteMany().catch(()=>{});
    await prisma.category.deleteMany().catch(()=>{});
    await prisma.user.deleteMany().catch(()=>{});

    // registrar usuario y obtener token
    await request(app).post('/auth/register').send(user);
    const r = await request(app).post('/auth/login').send({ email: user.email, password: user.password });
    token = r.body && r.body.data && r.body.data.token;
  });

  afterAll(async () => {
    await prisma.albums.deleteMany().catch(()=>{});
    await prisma.tag.deleteMany().catch(()=>{});
    await prisma.category.deleteMany().catch(()=>{});
    await prisma.user.deleteMany().catch(()=>{});
    await prisma.$disconnect();
  });

  describe('Categorías (protegido)', () => {
    test('POST /category denegado sin token', async () => {
      const res = await request(app).post('/categories').send({ name: 'Indie', description: 'desc' });
      expect([401,403]).toContain(res.statusCode);
    });

    test('crear, actualizar y eliminar categoría con token', async () => {
      const create = await request(app).post('/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Indie', description: 'desc' });
      expect([200,201]).toContain(create.statusCode);
      expect(create.body.status).toBe('success');
      category = create.body.data;

      const upd = await request(app).put(`/categories/${category.id}`).set('Authorization', `Bearer ${token}`).send({ description: 'actualizado' });
      expect([200,201]).toContain(upd.statusCode);
      expect(upd.body.status).toBe('success');

      const del = await request(app).delete(`/categories/${category.id}`).set('Authorization', `Bearer ${token}`);
      expect([200,201]).toContain(del.statusCode);
      expect(del.body.status).toBe('success');
    });
  });

  describe('Tags (protegido)', () => {
    test('POST /tags denegado sin token', async () => {
      const res = await request(app).post('/tags').send({ name: 'rock' });
      expect([401,403]).toContain(res.statusCode);
    });

    test('crear, actualizar y eliminar tag con token', async () => {
      const c = await request(app).post('/tags').set('Authorization', `Bearer ${token}`).send({ name: 'rock' });
      expect([200,201]).toContain(c.statusCode);
      expect(c.body.status).toBe('success');
      tag = c.body.data;

      const u = await request(app).put(`/tags/${tag.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'rock-upd' });
      expect([200,201]).toContain(u.statusCode);
      expect(u.body.status).toBe('success');

      const d = await request(app).delete(`/tags/${tag.id}`).set('Authorization', `Bearer ${token}`);
      expect([200,201]).toContain(d.statusCode);
      expect(d.body.status).toBe('success');
    });
  });

  describe('Albums (CRUD protegido) y lecturas públicas', () => {
    const payload = {
      name: 'Evermore',
      description: 'Album Evermore',
      price: 19.99,
      stock: 50,
      author: 'Taylor Swift',
      discography: 'Republic',
      deluxeVersion: true,
      category: 'Indie Folk',
      tags: ['indie', 'folk']
    };

    test('POST /albums denegado sin token', async () => {
      const res = await request(app).post('/albums').send(payload);
      expect([401,403]).toContain(res.statusCode);
    });

    test('crear album con token', async () => {
      const res = await request(app).post('/albums').set('Authorization', `Bearer ${token}`).send(payload);
      expect([200,201]).toContain(res.statusCode);
      expect(res.body.status).toBe('success');
      album = res.body.data;
      expect(album).toHaveProperty('id');
      expect(album).toHaveProperty('slug');
    });

    test('PUT /albums/:id y DELETE /albums/:id denegados sin token', async () => {
      const upd = await request(app).put(`/albums/${album.id}`).send({ price: 15 });
      expect([401,403]).toContain(upd.statusCode);

      const del = await request(app).delete(`/albums/${album.id}`);
      expect([401,403]).toContain(del.statusCode);
    });

    test('GET /albums listado público con paginación y filtros', async () => {
      const res = await request(app).get('/albums/').query({ page: 1, limit: 5, search: 'evermore', author: 'Taylor Swift', price_min: 10, price_max: 30, deluxeVersion: true, discography: 'Republic Records' });
      if (res.statusCode !== 200) {
        console.error('DEBUG /albums -> status:', res.statusCode, '\nbody:', JSON.stringify(res.body, null, 2))};
     
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data).toHaveProperty('meta');
    });

    test('GET /:id-:slug devuelve producto cuando el slug es correcto', async () => {
      const res = await request(app).get(`/albums/${album.id}-${album.slug}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id', album.id);
    });

    test('GET /:id-:slug redirige 301 cuando el slug es incorrecto', async () => {
      const res = await request(app).get(`/albums/${album.id}-wrong-slug`).redirects(0);
      expect(res.statusCode).toBe(301);
      expect(res.headers).toHaveProperty('location');
      expect(res.headers.location).toBe(`/albums/${album.id}-${album.slug}`);
    });
  });
});
