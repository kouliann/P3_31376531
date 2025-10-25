var express = require('express');
var router = express.Router();

const auth = require('../middleware/auth');
const UserController = require('../src/controllers/userControllers');
const controller = new UserController();
const jwt = require('jsonwebtoken');
const UserService = require('../src/services/userServices');
const userService = new UserService();

/* GET home page. */
router.get('/', async (req, res) => {
  try {
    const users = await controller.userService.getAllUsers();
    return res.json({ status: 'success', data: users });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'DB error' });
  }
});


//auth routes (register/login)
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
    if (!user) {
      return res.status(401).json({ status: 'fail', data: { message: 'Invalid credentials' }});
    }

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });

    return res.json({ status: 'success', data: { user, token }});
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Auth error' });
  }
});

//user routes

router.get('/users', auth, async (req, res) => {
  try {
    const users = await controller.userService.getAllUsers();
    // Tu test espera que el cuerpo sea JSend ({ status: 'success', data: [...] })
    return res.json({ status: 'success', data: users }); 
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'DB error' });
  }
});

router.post('/users', auth, (req, res) => controller.createUser(req, res));
router.get('/users/:id', auth, (req, res) => controller.getUser(req, res));
router.put('/users/:id', auth, (req, res) => controller.updateUser(req, res));
router.delete('/users/:id', auth, (req, res) => controller.deleteUser(req, res));

module.exports = router;
