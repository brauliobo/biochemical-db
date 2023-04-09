const query  = require('querystring')
const libxml = require('libxmljs-dom')

kegg = {

  baseUrl: `https://www.genome.jp`,

  typeMap: {
    compound: {
      id:     'cpd',
      name:   'compound',
      prefix: 'C',
    },
    reaction: {
      id:     'rn',
      name:   'reaction',
      prefix: 'R',
    },
    enzyme: {
      id:     'ec',
      name:   'enzyme',
      prefix: '',
    },
    disease: {
      id:     'ds',
      name:   'disease',
      prefix: 'H',
    },
    human_gene: {
      id:     'hsa',
      name:   'human_gene',
      prefix: '',
    },
  },

  databases: {

    list: [
      // Compounds
      'br08009', // Natural Toxins
      'br08003', // Phytochemical Compounds
      'br08021', // Glycosides
      'br08005', // Bioactive Peptides
      'br08006', // Endocrine Disrupting Compounds
      'br08007', // Pesticides
      'br08008', // Carcinogens
      // Reactions
      'br08201', // Enzymatic reactions
      'br08202', // IUBMB Reaction Hierarchy
      // Diseases
      'br08402', // Human diseases
      // Enzymes
    ],

    baseUrl: `https://www.genome.jp/kegg-bin/download_htext`,

    download(id) {
      var params = {
        htext:  `${id}.keg`,
        format: 'json',
      }
      var url = `${this.baseUrl}?${query.stringify(params)}`
      return new Promise(resolve => fetchCached(url, {file: id}).then(json => resolve(JSON.parse(json))))
    },
  },

  index: {

    queue: new Queue(10),

    parse(index) {
      return this.parseOne(index)
    },
    
    parseOne(index) {
      if (index.children) return index.children.flatMap(c => this.parseOne(c)).filter(c => c)

      var captures = index.name.match(/([HCR]\d+|\d+\.[\d\-]+\.[\d\-]+(?:\.[\d\-]+)?)\s*([^\[]+)?\s?(\[)?/)
      if (!captures) return puts(`Ignoring ${index.name}`)
      var [,id,name] = captures
      var type = _.find(kegg.typeMap, t => t.prefix == id[0]) || kegg.typeMap.enzyme

      this.queue.enqueue(() => this.parseType(type, id))

      return {
        id:   id,
        type: type.name,
        name: (name || '').trim(),
      }
    },

    async parseType(type, id) {
      return await kegg[type.name](id)
    },
  },

  database(id) {
    if (id == 'all') return Promise.all(this.databases.list.map(id => this.database(id)))
    data.batch = true

    return new Promise(resolve => {
      this.databases.download(id).then((i) => resolve(this.index.parse(i)))
    })
  },

  async compound(id) {
    return this.fetch(this.typeMap.compound, id).then(page => Promise.resolve({
      identifier: page.hValue('Entry').capture(/(C\d+)/),
      url:        page.url,
      names:      page.hValue('Name').split('\n').map(v => v.replace(/;$/,'')),
      formula:    page.hValue('Formula'),
      exact_mass: page.hValue('Exact mass'),
      mol_weight: page.hValue('Mol weight'),
      reactions:  page.reactions(),
      enzymes:    page.enzymes(),
      references: page.references(),
      cross_refs: page.externalLinks(),
    })).catch((e) => this.catch(id, e))
  },

  async reaction(id) {
    return this.fetch(this.typeMap.reaction, id).then(page => Promise.resolve({
      identifier: page.hValue('Entry').capture(/(R\d+)/),
      url:        page.url,
      name:       page.hValue('Name'),
      definition: page.hValue('Definition'),
      equation:   page.equation(),
      enzymes:    page.enzymes(),
      references: page.references(),
      cross_refs: page.externalLinks(),
    })).catch((e) => this.catch(id, e))
  },

  async enzyme(id) {
    return this.fetch(this.typeMap.enzyme, id).then(page => Promise.resolve({
      identifier: page.hValue('Entry').capture(/([\d\.]+)/),
      number:     page.hValue('Entry').capture(/([\d\.]+)/),
      url:        page.url,
      names:      page.hValue('Name').split('\n').map(v => v.replace(/;$/,'')),
      sysname:    page.hValue('Sysname'),
      classes:    page.hValue('Class').split('\n').map(v => v.replace(/;$/,'')),
      reaction:   page.reaction(),
      substrates: page.compounds('Substrate'),
      products:   page.compounds('Product'),
      references: page.references(),
      cross_refs: page.externalLinks(),
      genes:      page.genes('Genes'),
    })).catch((e) => this.catch(id, e))
  },

  async disease(id) {
    return this.fetch(this.typeMap.disease, id).then(page => Promise.resolve({
      identifier:  page.hValue('Entry').capture(/(H\d+)/),
      url:         page.url,
      description: page.hValue('Description'),
      category:    page.hValue('Category'),
      genes:       page.linkedGenes('Gene'),
      env_factors: page.hValue('Env factor').split('\n').filter(f => f),
      drugs:       page.drugs('Drug'),
      references:  page.references(),
    }, (o) => Promise.resolve(o))).catch((e) => this.catch(id, e))
  },

  fetch(type, id) {
    return data.fetchWithCache(type, id).then(obj => {
      if (obj) return Promise.reject(obj)
      var url = `${this.baseUrl}/dbget-bin/www_bget?${type.id}:${id}`
      return new Promise(resolve => {
        fetchCached(url, {file: id}).then(page => {
          var doc = libxml.parseHtml(page, {baseUrl: url})
          page    = new this.page(doc, url, id)
          resolve(page)
        }).catch((e) => this.catch(id, e))
      })
    })
  },

  catch(id, err) {
    if (err instanceof Error) {
      puts(`${id}: ${err}`)
      if (!data.batch) throw err
    }
  },

  page: class Page {
    db_links = {
      ExplorEnz: 'explorenz_url',
      IUBMB:     'iubmb_url',
      ExPASy:    'expasy_url',
      BRENDA:    'brenda_url',
      RHEA:      'rhea_url',
    }
    
    constructor(doc, url, id) {
      this.doc   = doc
      this.url   = url
      this.id    = id
      this.table = doc.querySelector('table.w2[width="650"]')
    }

    externalLinks() {
      var h = 'Other DBs'
      var refs = {}
      this.rowSelectAll(h).map((r,i) => {
        var v = this.rowValue(r, 1).split(/[, :]/)[0]
        var l = this.db_links[v]
        if (l) refs[l] = this.rowLink(r).url
      })
      return refs
    }

    references() {
      var h = 'Reference'
      return this.rows(h).map((reference, i) => {
        var authors = this.sibblingHeader(reference, 'Authors')
        var title   = this.sibblingHeader(reference, 'Title')
        var journal = this.sibblingHeader(reference, 'Journal')
        return {
          pmid:    this.rowValue(reference).capture(/PMID:(\d+)/),
          doi_id:  this.rowValue(journal).capture(/DOI:([\d\.\/()\-]+)/),
          authors: this.rowValue(authors).split(', ').filter(a => a),
          title:   this.rowValue(title),
          journal: this.rowValue(journal),
        }
      })
    }

    linkedGenes(h) {
      return this.hValue(h).split('\n').filter(g => g).flatMap((g, i) => {
        var captures = g.match(/([^\[]+)(?: \(([^\)]+)\))? \[HSA:([\d\s]+)\]/)
        if (!captures || !captures[3]) return puts(`${this.id}: Skipping gene '${g}' without id`)
        var ids      = captures[3].split(' ')
        return ids.map(id => {
          return {
            identifier: captures[1],
            variation:  captures[2],
            kegg_id:    id,
            kegg_url:   this.linkFor(kegg.typeMap.human_gene, id),
          }
        })
      })
    }

    genes(h) {
      return this.rowSelectAll(h).map(el => {
        var link = this.link(el.querySelector('a'))
        return {
          organism: this.text(el).capture(/(.+):\s/),
          kegg_id:  link.text,
          kegg_url: link.url,
        }
      })
    }

    drugs(h) {
      return this.hValue(h).split('\n').filter(d => d).map((c, i) => {
        var link = this.headerLink(h, i+1)
        return {
          name:     c.capture(/(.+) \[DR/),
          kegg_id:  link.text,
          kegg_url: link.url,
        }
      })
    }

    compounds(h) {
      return this.hValue(h).split('\n').filter(c => c).map((c, i) => {
        c = c.replace(/;$/,'')
        var link = this.headerLink(h, i+1)
        return {
          name:     c.capture(/(.+) \[CPD/),
          kegg_id:  link ? link.text : null,
          kegg_url: link ? link.url  : null,
        }
      })
    }

    equation() {
      var container = this.rowSelect('Equation', {selector: 'td div'}).childNodes
      var e = {reactants: [], products: []}
      var firstPart = true, coefficient = 1
      _.each(container, c => {
        if (c.innerText.trim() == '<=>') { firstPart = false; return }
        if (c.nodeName == 'text') coefficient = parseInt(c.innerText.capture(/\+\s(\d+)?/) || 1)
        if (c.nodeName != 'a') return

        var l = this.link(c)
        c = {coefficient: coefficient, identifier: l.text, url: l.url}
        if ( firstPart) return e.reactants.push(c)
        if (!firstPart) return e.products.push(c)
      })
      return e
    }

    reactions() {
      return this.headerLinks('Reaction').map(l => {
        return {
          identifier: l.text,
          url:        l.url,
        }
      })
    }

    enzymes() {
      return this.headerLinks('Enzyme').map(l => {
        return {
          identifier: l.text,
          url:        l.url,
        }
      })
    }

    reaction() {
      var h    = 'Reaction(IUBMB)'
      var link = this.headerLink(h)
      return {
        representation: this.hValue(h).capture(/(.+)(?: \[RN)?/),
        kegg_id:        link ? link.text : null,
        kegg_url:       link ? link.url  : null,
      }
    }

    headerLinks(h) {
      var links = this.rowSelectAll(h, {selector: 'td a'})
      return links.map(l => this.link(l))
    }

    headerLink(h, i = 1) {
      return this.rowLink(this.row(h), i)
    }

    rowLink(row, i = 1) {
      if (!row) return
      var link = row.querySelector(`a:nth-of-type(${i})`)
      return this.link(link)
    }

    link(el) {
      if (!el) return
      var url = el.href.startsWith('/') ? `${kegg.baseUrl}${el.href}` : el.href
      return {
        text: el.innerText,
        url:  url,
      }
    }

    linkFor(type, id) {
      return `${kegg.baseUrl}/dbget-bin/www_bget?${type.id}:${id}`
    }

    rowSelect(h, {selector = 'td'} = {}) {
      var row = this.row(h)
      if (!row) return 
      return row.querySelector(selector)
    }
    rowSelectAll(h, {selector = 'td table'} = {}) {
      var row = this.row(h)
      if (!row) return []
      return row.querySelectorAll(selector)
    }

    sibblingHeader(r, nh) {
      var rh = this.text(r.querySelector('th'))
      var n  = r
      while (n = n.nextElementSibling) {
        var sh = this.text(n.querySelector('th'))
        if (sh == rh) return
        if (sh == nh) return n
      }
    }

    hValue(h, {selector = 'td'} = {}) {
      return this.text(this.rowSelect(h, {selector: selector}))
    }
    rowValue(row, i = 1, {selector = `td:nth-of-type(${i})`} = {}) {
      if (!row) return ''
      return this.text(row.querySelector(selector))
    }
    text(el) {
      if (!el) return ''
      return el.innerText.trim()
    }

    rows(h) {
      return this.table.querySelectorAll(`tr > th:contains('${h}')`).map((th) => th.parentElement)
    }
    row(h) {
      var th = this.table.querySelector(`tr > th:contains('${h}')`)
      if (th) return th.parentElement
    }

  },

}

