require('./useTestDb');

const path = require('path');
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = require('../app');

const PaymentProcessor = require('../src/strategies/payment/PaymentStrategy');

describe('Orders transactional tests', () => {
  let token;
  let userId;
  let category;
  let album1;
  let album2;

  beforeAll(async () => {
  // 1. Borrar primero las tablas que tienen claves foráneas hacia User

  await prisma.order.deleteMany(); 

  await prisma.user.deleteMany();


    // create user via API and obtain token
    const u = { nombreCompleto: 'OrderTester', email: 'ordertester@example.com', password: 'Secret123!' };
    await request(app).post('/auth/register').send(u);
    const r = await request(app).post('/auth/login').send({ email: u.email, password: u.password });
    token = r.body.data.token;
    // fetch user id
    const usersRes = await request(app).get('/users').set('Authorization', `Bearer ${token}`);
    userId = usersRes.body.data.find(x => x.email === u.email).id;

    // create a category and two albums directly
    category = await prisma.category.create({ data: { name: 'TestCat' } });
    album1 = await prisma.albums.create({ data: { name: 'A1', slug: 'a1', price: 10.0, stock: 5, author: 'X', discography: 'D', deluxeVersion: false, categoryId: category.id } });
    album2 = await prisma.albums.create({ data: { name: 'A2', slug: 'a2', price: 20.0, stock: 2, author: 'Y', discography: 'D2', deluxeVersion: false, categoryId: category.id } });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany().catch(()=>{});
    await prisma.orderItem.deleteMany().catch(()=>{});
    await prisma.order.deleteMany().catch(()=>{});
    await prisma.albums.deleteMany().catch(()=>{});
    await prisma.tag.deleteMany().catch(()=>{});
    await prisma.category.deleteMany().catch(()=>{});
    await prisma.user.deleteMany().catch(()=>{});
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks(); 
  });

  test('Success transaction: order created, items recorded, stock reduced', async () => {
    // mock payment success
    jest.spyOn(PaymentProcessor.prototype, 'processPayment').mockResolvedValue({ success: true, providerPaymentId: 'ok_1', raw: {} });

    const payload = {
      items: [ { albumId: album1.id, quantity: 2 }, { albumId: album2.id, quantity: 1 } ],
      paymentMethod: 'creditcard',
      paymentDetails: { card: '4111' },
      currency: 'USD'
    };

    const res = await request(app).post('/orders').set('Authorization', `Bearer ${token}`).send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('success');
    const order = res.body.data.order; 
    expect(order).toHaveProperty('id');
    expect(order.totalAmount).toBe(40);

    // verify DB: order exists and stock updated
    const dbAlbum1 = await prisma.albums.findUnique({ where: { id: album1.id } });
    const dbAlbum2 = await prisma.albums.findUnique({ where: { id: album2.id } });
    expect(dbAlbum1.stock).toBe(album1.stock - 2);
    expect(dbAlbum2.stock).toBe(album2.stock - 1);

    const dbOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true, Payment: true } });
    expect(dbOrder).toBeTruthy();
    expect(dbOrder.items.length).toBe(2);
    expect(dbOrder.Payment.length).toBeGreaterThanOrEqual(1);
  });

  test('Fail: insufficient stock should return error and not change other stocks', async () => {
    // prepare: album2 has only 2 stock; request more than available
    const initial1 = (await prisma.albums.findUnique({ where: { id: album1.id } })).stock;
    const initial2 = (await prisma.albums.findUnique({ where: { id: album2.id } })).stock;

    const payload = {
      items: [ { albumId: album1.id, quantity: 1 }, { albumId: album2.id, quantity: 999 } ],
      paymentMethod: 'creditcard',
      paymentDetails: {}
    };

    const res = await request(app).post('/orders').set('Authorization', `Bearer ${token}`).send(payload);
    expect([400, 500]).toContain(res.statusCode);

    // verify stocks unchanged
    const after1 = (await prisma.albums.findUnique({ where: { id: album1.id } })).stock;
    const after2 = (await prisma.albums.findUnique({ where: { id: album2.id } })).stock;
    expect(after1).toBe(initial1);
    expect(after2).toBe(initial2);

    // ensure no new order created referencing user with high total
    const orders = await prisma.order.findMany({ where: { userId: String(userId) } });
    // there should be at least previous order(s) but none with items quantity 999
    const bad = await prisma.orderItem.findFirst({ where: { quantity: 999 } });
    expect(bad).toBeNull();
  });

  test('Fail payment rejected: rollback complete', async () => {
   
    jest.spyOn(PaymentProcessor, 'process').mockResolvedValue({ 
      success: false, 
      message: 'declined',
      isTimeout: false 
    });

    const init1 = (await prisma.albums.findUnique({ where: { id: album1.id } })).stock;
    const beforeCount = await prisma.order.count({ where: { userId: String(userId) } });

    const payload = { 
      items: [ { albumId: album1.id, quantity: 1 } ], 
      paymentMethod: 'creditcard', 
      paymentDetails: { card: '1234' } // Agrega esto para pasar la validación del controller
    };
    
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // El controlador devuelve 400 cuando el pago falla
    expect(res.statusCode).toBe(400);
    expect(res.body.data.message).toBe('declined');

    // Verificación de Rollback
    const after1 = (await prisma.albums.findUnique({ where: { id: album1.id } })).stock;
    expect(after1).toBe(init1);
    const afterCount = await prisma.order.count({ where: { userId: String(userId) } });
    expect(afterCount).toBe(beforeCount);
  });

  test('Fail payment timeout: returns 504 and rollback', async () => {
    
    jest.spyOn(PaymentProcessor, 'process').mockResolvedValue({ 
      success: false, 
      message: 'timeout of 15000ms exceeded', 
      isTimeout: true 
    });

    const init1 = (await prisma.albums.findUnique({ where: { id: album1.id } })).stock;
    
    const payload = { 
      items: [ { albumId: album1.id, quantity: 1 } ], 
      paymentMethod: 'creditcard', 
      paymentDetails: { card: '1234' } 
    };

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // El controlador está programado para devolver 504 si isTimeout es true
    expect(res.statusCode).toBe(504);
    
    const after1 = (await prisma.albums.findUnique({ where: { id: album1.id } })).stock;
    expect(after1).toBe(init1);
  });

  test('Access control: POST /orders requires auth', async () => {
    const payload = { items: [ { albumId: album1.id, quantity: 1 } ], paymentMethod: 'creditcard', paymentDetails: {} };
    const res = await request(app).post('/orders').send(payload);
    expect(res.statusCode).toBe(401);
  });
});
