const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const UserController = require('../controllers/userControllers');
const controller = new UserController();

router.get('/', auth, async (req, res) => {
  try {
    const users = await controller.userService.getAllUsers();
    return res.json({ status: 'success', data: users });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'DB error' });
  }
});

router.get('/users/:id', auth, (req, res) => controller.getUser(req, res));
router.post('/users', auth, (req, res) => controller.createUser(req, res));
router.put('/users/:id', auth,(req, res) => controller.updateUser(req, res));
router.delete('/users/:id', auth, (req, res) => controller.deleteUser(req, res));
module.exports = router;