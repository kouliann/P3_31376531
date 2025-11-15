const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth'); 
const AlbumsController = require('../controllers/AlbumsControllers');
const controller = new AlbumsController();

router.get('/', controller.publicList.bind(controller));
router.get('/:idSlug', controller.publicView.bind(controller));
router.get('/:id', auth,  controller.get.bind(controller));
router.post('/', auth, controller.createAlbums.bind(controller));
router.put('/:id', auth, controller.update.bind(controller));
router.delete('/:id', auth, controller.remove.bind(controller));

module.exports = router;