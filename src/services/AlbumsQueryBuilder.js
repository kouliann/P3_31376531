class AlbumsQueryBuilder {
  constructor() {
    this._where = {};
    this._include = { category: true, tags: true };
    this._orderBy = { createdAt: 'desc' };
    this._skip = 0;
    this._take = 10;
  }

  pagination(page = 1, limit = 10) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 10));
    this._skip = (p - 1) * l;
    this._take = l;
    return this;
  }

  category(category) {
    if (!category) return this;
    const num = Number(category);
    if (!Number.isNaN(num)) this._where.categoryId = num;
    else this._where.category = { name: String(category) };
    return this;
  }

  tags(tags) {
    if (!tags) return this;
    const items = String(tags).split(',').map(s => s.trim()).filter(Boolean);
    const ids = items.map(i => Number(i)).filter(n => !Number.isNaN(n));
    const names = items.filter(i => isNaN(Number(i)));
    if (ids.length) this._where.tags = { some: { id: { in: ids } } };
    else if (names.length) this._where.tags = { some: { name: { in: names } } };
    return this;
  }

  priceRange(min, max) {
    if (typeof min === 'undefined' && typeof max === 'undefined') return this;
    this._where.price = {};
    if (typeof min !== 'undefined') {
      const m = Number(min);
      if (!Number.isNaN(m)) this._where.price.gte = m;
    }
    if (typeof max !== 'undefined') {
      const M = Number(max);
      if (!Number.isNaN(M)) this._where.price.lte = M;
    }
    if (Object.keys(this._where.price).length === 0) delete this._where.price;
    return this;
  }

  search(term) {
    if (!term) return this;
    const q = String(term);
    this._where.OR = [
      { name: { contains: q, } },
      { description: { contains: q, } }
    ];
    return this;
  }

  // filtros personalizados de Albums: author, discography, deluxeVersion
  author(author) {
    if (!author) return this;
    this._where.author = { contains: String(author)};
    return this;
  }

  discography(discography) {
    if (!discography) return this;
    this._where.discography = { contains: String(discography) };
    return this;
  }

  deluxeVersion(val) {
    if (typeof val === 'undefined' || val === null) return this;
    const s = String(val).toLowerCase();
    if (s === 'true' || s === '1') this._where.deluxeVersion = true;
    else if (s === 'false' || s === '0') this._where.deluxeVersion = false;
    return this;
  }

  orderBy(orderBy) {
    if (!orderBy) return this;
    const [field, dir] = String(orderBy).split(':');
    if (field) this._orderBy = { [field]: dir === 'asc' ? 'asc' : 'desc' };
    return this;
  }

  build() {
    return {
      where: this._where,
      include: this._include,
      orderBy: this._orderBy,
      skip: this._skip,
      take: this._take
    };
  }
}

module.exports = AlbumsQueryBuilder;