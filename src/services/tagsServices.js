const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class tagsService {
    async createTag(data){
        if (!data || !data.name) throw new Error('nombre requerido');
            const insert = { name: data.name };
            const tag = await prisma.tag.create({ data: insert });
        return tag;
    }

    async getTagById(id){
        return prisma.tag.findUnique({ where: { id: Number(id) }});
    }

    async getAllTags(){
        return prisma.tag.findMany({ orderBy: { createdAt: 'desc' }});
    }

    async updateTag(id, changes = {}){
        const tagId = Number(id);
        const data = {}
        if (changes.name) {
            data.name = changes.name;
        }
        if (typeof changes.description !== 'undefined') data.description = changes.description;
        
        const updated = await prisma.tag.update({
            where: { id: tagId },
            data,
        });
        return updated;
    }
    async deleteTag(id){
        await prisma.tag.delete({ where: { id: Number(id) }});
        return true;
    }
}

module.exports = tagsService;