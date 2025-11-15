const tagsService = require('../services/tagsServices');

class tagsController {
    constructor() {
        this.service = new tagsService();
    }

    async createTag (req, res) {
        try {
            const t = await this.service.createTag(req.body);
            return res.status(201).json({ status: 'success', data: t });
        }catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }

    async listTags (req, res) {
        try {
            const data = await this.service.getAllTags();
            return res.json({ status: 'success', data });
        } catch (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
    }
    async getById (req, res) {
        try {
            const t = await this.service.getTagById(req.params.id);
            if (!t) return  res.status(404).json({ status: 'fail', data: { message: 'No encontrado' }});
            return res.json({ status: 'success', data: t });
        } catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }

    async updateTag (req, res) {
        try {
            const t = await this.service.updateTag(req.params.id, req.body);
            return res.json({ status: 'success', data: t });
        } catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }

    async deleteTag (req, res) {
        try {
            await this.service.deleteTag(req.params.id);
            return res.json({ status: 'success', data: { id: Number(req.params.id) }});
        }catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }
}

module.exports = tagsController;