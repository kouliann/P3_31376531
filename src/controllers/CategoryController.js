const categoryService = require('../services/CategoryService');

class categoryController {
    constructor() {
        this.service = new categoryService();
    }

    async createCategory (req, res) {
        try {
            const c = await this.service.createCategory(req.body);
            return res.status(201).json({ status: 'success', data: c });
        }catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }  
    }

    async listCategories (req, res) {
        try {
            const data = await this.service.getAllCategories();
            return res.json({ status: 'success', data });
        } catch (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
    }

    async getById (req, res) {
        try {
            const c = await this.service.getCategoryById(req.params.id);
            if (!c) return  res.status(404).json({ status: 'fail', data: { message: 'No encontrado' }});
            return res.json({ status: 'success', data: c });
        } catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }

    async updateCategory (req, res) {
        try {
            const c = await this.service.updateCategory(req.params.id, req.body);
            return res.json({ status: 'success', data: c });
        } catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }

    async deleteCategory (req, res) {
        try {
            await this.service.deleteCategory(req.params.id);
            return res.json({ status: 'success', data: { id: Number(req.params.id) }});
        } catch (err) {
            return res.status(400).json({ status: 'fail', data: { message: err.message }});
        }
    }

}

module.exports = categoryController;