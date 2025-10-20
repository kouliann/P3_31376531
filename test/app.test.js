

const request = require('supertest');
const app = require('../app');

describe('Endpoints', () => {
  test('GET /ping -> 200 and empty body', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.text).toBe('');
  });

  test('GET /about -> 200 and JSend success with data', async () => {
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
});

