const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth'); 
const AlbumsController = require('../controllers/CategoryController');
const controller = new AlbumsController();

router.get('/', controller.listCategories.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post('/', auth, controller.createCategory.bind(controller));
router.put('/:id', auth, controller.updateCategory.bind(controller));
router.delete('/:id', auth, controller.deleteCategory.bind(controller));

module.exports = router;