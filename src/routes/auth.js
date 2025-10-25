const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const UserService = require('../services/userServices');
const userService = new UserService();
require('dotenv').config();

router.post('/auth/register', async (req, res) => {
  try {
    const { nombreCompleto, email, password } = req.body;
    const user = await userService.registerUser(nombreCompleto, email, password);
    return res.status(201).json({ status: 'success', data: user });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ status: 'fail', data: { message: 'Email en uso' }});
    }
    return res.status(400).json({ status: 'fail', data: { message: err.message }});
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userService.authenticateUser(email, password);
    if (!user) return res.status(401).json({ status: 'fail', data: { message: 'Invalid credentials' }});
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });
    return res.json({ status: 'success', data: { token }});
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Auth error' });
  }
});

module.exports = router;