const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class categoryService {
    async createCategory(data){
        if (!data.name) throw new Error('nombre requerido');
        const category = await prisma.category.create({ data });
        return category;
    }

    async getCategoryById(id){
        return prisma.category.findUnique({ where: { id: Number(id) }});
    }

    async getAllCategories(){
        return prisma.category.findMany({ orderBy: { createdAt: 'desc' }});
    }

    async updateCategory(id, changes = {}){
        const prodId = Number(id);
        const data = {}
        if (changes.name) {
            data.name = changes.name;
        }
        if (typeof changes.name !== 'undefined') data.description = chamge.description;
        
        const updated = await prisma.category.update({
            where: { id: prodId },
            data,
        });
        
        return updated;
    }
    
    async deleteCategory(id){
        await prisma.category.delete({ where: { id: Number(id) }});
        return true;
    }
}

module.exports = categoryService;