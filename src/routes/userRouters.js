const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const UserController = require('../controllers/userControllers');
const controller = new UserController();



router.get('/:id', auth, (req, res) => controller.getUser(req, res));
router.post('/', auth, (req, res) => controller.createUser(req, res));
router.put('/:id', auth,(req, res) => controller.updateUser(req, res));
router.delete('/:id', auth, (req, res) => controller.deleteUser(req, res));


module.exports = router;