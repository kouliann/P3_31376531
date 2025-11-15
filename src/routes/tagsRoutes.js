const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const TagsController = require('../controllers/tagsController');
const controller = new TagsController();

router.get('/', controller.listTags.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post('/', auth, controller.createTag.bind(controller));
router.put('/:id', auth, controller.updateTag.bind(controller));
router.delete('/:id', auth, controller.deleteTag.bind(controller));

module.exports = router;