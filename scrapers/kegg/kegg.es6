const query  = require('querystring')
const libxml = require('libxmljs-dom')

kegg = {

  baseUrl: `https://www.genome.jp`,

  typeMap: {
    compound: {
      name:   'compound',
      id:     'cpd',
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
      name:   'disease',
      id:     'ds',
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

    parse(index) {
      return this.parseOne(index)
    },
    
    parseOne(index) {
      if (index.children) return index.children.flatMap(c => this.parseOne(c)).filter(c => c)

      var captures = index.name.match(/([HCR]\d+|\d+\.[\d\-]+\.[\d\-]+(?:\.[\d\-]+)?)\s*([^\[]+)?\s?(\[)?/)
      //if (!captures) debugger
      if (!captures) return puts(`Ignoring ${index.name}`)
      var [,id,name] = captures

      var type = _.find(kegg.typeMap, t => t.prefix == id[0]) || kegg.typeMap.enzyme
      this.cache(type, id)
      return {
        id:   id,
        type: type.name,
        name: (name || '').trim(),
      }
    },

    cache(type, id) {
      kegg[type.name](id)
    },
  },

  database(id) {
    if (id == 'all') return Promise.all(this.databases.list.map(id => this.database(id)))

    return new Promise(resolve => {
      this.databases.download(id).then((i) => resolve(this.index.parse(i)))
    })
  },

  disease(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.disease.id, id).then(page => {
        resolve({
          identifier:  page.hValue('Entry').capture(/(H\d+)/),
          url:         page.url,
          description: page.hValue('Description'),
          category:    page.hValue('Category'),
          genes:       page.linkedGenes('Gene'),
          env_factors: page.hValue('Env factor').split('\n'),
          drugs:       page.drugs('Drug'),
          references:  page.references(),
        })
      })
    })
  },

  enzyme(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.enzyme.id, id).then(page => {
        resolve({
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
        })
      })
    })
  },

  compound(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.compound.id, id).then(page => {
        resolve({
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
        })
      })
    })
  },

  reaction(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.reaction.id, id).then(page => {
        resolve({
          identifier: page.hValue('Entry').capture(/(R\d+)/),
          url:        page.url,
          name:       page.hValue('Name'),
          definition: page.hValue('Definition'),
          equation:   page.equation(),
          enzymes:    page.enzymes(),
          references: page.references(),
          cross_refs: page.externalLinks(),
        })
      })
    })
  },

  fetch(prefix, id) {
    var url = `${this.baseUrl}/dbget-bin/www_bget?${prefix}:${id}`
    return new Promise(resolve => {
      fetchCached(url, {file: id}).then(page => {
        var doc = libxml.parseHtml(page, {baseUrl: url})
        resolve(new this.page(doc, url))
      })
    })
  },

  page: class Page {
    db_links = {
      ExplorEnz: 'explorenz_url',
      IUBMB:     'iubmb_url',
      ExPASy:    'expasy_url',
      BRENDA:    'brenda_url',
      RHEA:      'rhea_url',
    }
    
    constructor(doc, url) {
      this.doc   = doc
      this.url   = url
      this.table = doc.querySelector('form table table')
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
      return this.rows(h).map((r, i) => {
        var v = this.rowValue(r)
        var journal = this.rowValue(this.subrow('Title', 'Journal', i+1))
        return {
          number:  v.capture(/(\d+)\s/),
          pmid:    v.capture(/PMID:(\d+)/),
          doi_id:  journal.capture(/DOI:([\d\.\/()\-]+)/),
          authors: this.rowValue(this.subrow(h, 'Authors', i+1)).split(', '),
          title:   this.rowValue(this.subrow('Authors', 'Title', i+1)),
          journal: journal,
        }
      })
    }

    linkedGenes(h) {
      return this.hValue(h).split('\n').map((g, i) => {
        var captures = g.match(/([^ ]+) \(([^\)]+)\) \[HSA:(\d+)\]/)
        return {
          identifier: captures[1],
          variation:  captures[2],
          kegg_id:    captures[3],
          kegg_url:   this.linkFor(kegg.typeMap.human_gene, captures[3]),
        }
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
      return this.hValue(h).split('\n').map((c, i) => {
        var link = this.headerLink(h, i+1)
        return {
          name:     c.capture(/(.+) \[DR/),
          kegg_id:  link.text,
          kegg_url: link.url,
        }
      })
    }

    compounds(h) {
      return this.hValue(h).split('\n').map((c, i) => {
        c = c.replace(/;$/,'')
        var link = this.headerLink(h, i+1)
        return {
          name:     c.capture(/(.+) \[CPD/),
          kegg_id:  link.text,
          kegg_url: link.url,
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
        representation: this.hValue(h).capture(/(.+) \[RN/),
        kegg_id:        link.text,
        kegg_url:       link.url,
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
      var link = row.querySelector(`a:nth-of-type(${i})`)
      return this.link(link)
    }

    link(el) {
      var url = el.href.startsWith('/') ? `${kegg.baseUrl}${el.href}` : el.href
      return {
        text: el.innerText,
        url:  url,
      }
    }

    linkFor(type, id) {
      return `${kegg.baseUrl}/dbget-bin/www_bget?${type.id}:${id}`
    }

    rowValue(row, i = 1, {selector = `td:nth-of-type(${i})`} = {}) {
      return this.text(row.querySelector(selector))
    }

    hValue(h, {selector = 'td'} = {}) {
      return this.text(this.rowSelect(h, {selector: selector}))
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

    rows(h) {
      return this.table.querySelectorAll(`tr:contains('${h}')`)
    }

    subrow(h, sh, i = 1) {
      return this.table.querySelector(`tr:contains('${h}'):nth-of-type(${i}) + tr:contains('${sh}')`)
    }

    row(h) {
      return this.table.querySelector(`tr:contains('${h}')`)
    }

    text(el) {
      if (!el) return ''
      return el.innerText.trim()
    }

  },

}

