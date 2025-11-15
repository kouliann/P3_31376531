const AlbumsService = require('../services/AlbumsServices');

class AlbumsController {

  constructor() {
    this.service = new AlbumsService();
  }

  async publicView(req, res) {
    try {
      const idSlug = req.params.idSlug || '';
      // acepta "123-mi-producto" o simplemente "123"
      const match = /^(\d+)(?:-(.+))?$/.exec(idSlug);
      if (!match) {
        return res.status(400).json({ status: 'fail', data: { message: 'Identificador inválido' } });
      }

      const id = Number(match[1]);
      const slugFromUrl = match[2] || '';

      const album = await this.service.getAlbumsById(id);
      if (!album) {
        return res.status(404).json({ status: 'fail', data: { message: 'No encontrado' } });
      }

      const actualSlug = album.slug || '';
      if (slugFromUrl && slugFromUrl !== actualSlug) {
        // Self-healing: redirige permanentemente a la URL canónica
        const canonical = `/albums/${album.id}-${actualSlug}`;
        return res.redirect(301, canonical);
      }

      // Devuelve datos públicos (JSend)
      return res.json({ status: 'success', data: album });
    } catch (err) {
      return res.status(500).json({ status: 'error', data: { message: err.message } });
    }
  }

  async publicList(req, res) {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        category: req.query.category,
        tags: req.query.tags,
        price_min: req.query.price_min,
        price_max: req.query.price_max,
        search: req.query.search,
        author: req.query.author,
        discography: req.query.discography,
        deluxeVersion: req.query.deluxeVersion
      };

      const result = await this.service.search(filters);
      return res.json({
        status: 'success',
        data: {
          items: result.items,
          meta: result.meta
        }
      });
    } catch (err) {
      return res.status(400).json({ status: 'fail', data: { message: err.message } });
    }
  }

  async get(req, res) {
    try {
      const p = await this.service.getAlbumsById(req.params.id);
      if (!p) return res.status(404).json({ status: 'fail', data: { message: 'No encontrado' }});
      return res.json({ status: 'success', data: p });
    } catch (err) {
      return res.status(400).json({ status: 'fail', data: { message: err.message }});
    }
  }

  async createAlbums(req, res) {
    try {
      const p = await this.service.createAlbums(req.body);
      return res.status(201).json({ status: 'success', data: p });
    } catch (err) {
      return res.status(400).json({ status: 'fail', data: { message: err.message }});
    }
  }

  async update(req, res) {
    try {
      const p = await this.service.updateAlbums(req.params.id, req.body);
      return res.json({ status: 'success', data: p });
    } catch (err) {
      return res.status(400).json({ status: 'fail', data: { message: err.message }});
    }
  }

  async remove(req, res) {
    try {
      await this.service.deleteAlbums(req.params.id);
      return res.json({ status: 'success', data: { id: Number(req.params.id) }});
    } catch (err) {
      return res.status(400).json({ status: 'fail', data: { message: err.message }});
    }
  }
}

module.exports = AlbumsController;