const query    = require('querystring')
const osmosis  = require('osmosis')

kegg = {

  baseUrl: `https://www.genome.jp`,
  table:   null,

  typeMap: {
    disease: {
      name:   'disease',
      id:     'ds',
      prefix: 'H',
    },
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
    human_gene: {
      id:     'hsa',
      name:   'human_gene',
      prefix: '',
    },
  },

  databases: {

    list: [
      // Diseases
      'br08402', // Human diseases
      // Compounds
      'br08009', // Natural Toxins
      'br08003', // Phytochemical Compounds
      'br08021', // Glycosides
      'br08005', // Bioactive Peptides
      'br08006', // Endocrine Disrupting Compounds
      'br08007', // Pesticides
      'br08008', // Carcinogens
      // Enzymes
      // Reactions
    ],

    baseUrl: `https://www.genome.jp/kegg-bin/download_htext`,

    download(id) {
      var params = {
        htext:  `${id}.keg`,
        format: 'json',
      }
      var url = `${this.baseUrl}?${query.stringify(params)}`
      return new Promise(resolve => {
        fetch(url).then(response => response.json()).then(json => resolve(json))
      })
    },
  },

  index: {
    parse(index) {
      cache.setupDir(`kegg`)
      return this.parseOne(index)
    },
    
    parseOne(index) {
      if (index.children) return index.children.flatMap(c => this.parseOne(c)).filter(c => c)

      var captures = index.name.match(/([HCR]\d+|[1-9]+\.[1-9\-]+\.[1-9\-]+\.[1-9\-]+)\s*([^\[]+)?\s?(\[)?/)
      if (!captures) return puts(`Ignoring ${index.name}`)
      return {
        id:   captures[1],
        name: (captures[2] || '').trim(),
      }
    },
  },

  database(id) {
    return new Promise(resolve => {
      this.databases.download(id).then((i) => resolve(this.index.parse(i)))
    })
  },

  disease(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.disease.id, id).then((url, table) => {
        resolve({
          identifier:  this.h.hValue('Entry').capture(/(H\d+)/),
          url:         url,
          description: this.h.hValue('Description'),
          category:    this.h.hValue('Category'),
          genes:       this.h.linkedGenes('Gene'),
          env_factors: this.h.hValue('Env factor').split('\n'),
          drugs:       this.h.drugs('Drug'),
          references:  this.h.references(),
        })
      })
    })
  },

  enzyme(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.enzyme.id, id).then((url, table) => {
        resolve({
          identifier: this.h.hValue('Entry').capture(/([\d\.]+)/),
          number:     this.h.hValue('Entry').capture(/([\d\.]+)/),
          url:        url,
          names:      this.h.hValue('Name').split('\n').map(v => v.replace(/;$/,'')),
          sysname:    this.h.hValue('Sysname'),
          classes:    this.h.hValue('Class').split('\n').map(v => v.replace(/;$/,'')),
          reaction:   this.h.reaction(),
          substrates: this.h.compounds('Substrate'),
          products:   this.h.compounds('Product'),
          references: this.h.references(),
          cross_refs: this.h.externalLinks(),
          genes:      this.h.genes('Genes'),
        })
      })
    })
  },

  compound(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.compound.id, id).then((url, table) => {
        resolve({
          identifier: this.h.hValue('Entry').capture(/(C\d+)/),
          url:        url,
          names:      this.h.hValue('Name').split('\n').map(v => v.replace(/;$/,'')),
          formula:    this.h.hValue('Formula'),
          exact_mass: this.h.hValue('Exact mass'),
          mol_weight: this.h.hValue('Mol weight'),
          reactions:  this.h.reactions(),
          enzymes:    this.h.enzymes(),
          references: this.h.references(),
          cross_refs: this.h.externalLinks(),
        })
      })
    })
  },

  reaction(id) {
    return new Promise(resolve => {
      this.fetch(this.typeMap.reaction.id, id).then((url, table) => {
        resolve({
          identifier: this.h.hValue('Entry').capture(/(R\d+)/),
          url:        url,
          name:       this.h.hValue('Name'),
          definition: this.h.hValue('Definition'),
          equation:   this.h.equation(),
          enzymes:    this.h.enzymes(),
          references: this.h.references(),
          cross_refs: this.h.externalLinks(),
        })
      })
    })
  },

  fetch(prefix, id) {
    var url = `${this.baseUrl}/dbget-bin/www_bget?${prefix}:${id}`
    return new Promise(resolve => {
      osmosis.get(url).find('form table table').then(table => {
        if (table.index > 0) return
          this.table = table
        resolve(url, table)
      })
    })
  },

  h: {
    db_links: {
      ExplorEnz: 'explorenz_url',
      IUBMB:     'iubmb_url',
      ExPASy:    'expasy_url',
      BRENDA:    'brenda_url',
      RHEA:      'rhea_url',
    },
    db_ids: {

    },
    
    externalLinks() {
      var h = 'Other DBs'
      var refs = {}
      this.rowSelectAll(h).map((r,i) => {
        var v = this.rowValue(r, 1).split(/[, :]/)[0]
        var l = this.db_links[v]
        if (l) refs[l] = this.rowLink(r).url
      })
      return refs
    },

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
    },

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
    },

    genes(h) {
      return this.rowSelectAll(h).map(el => {
        var link = this.link(el.querySelector('a'))
        return {
          organism: this.text(el).capture(/(.+):\s/),
          kegg_id:  link.text,
          kegg_url: link.url,
        }
      })
    },

    drugs(h) {
      return this.hValue(h).split('\n').map((c, i) => {
        var link = this.headerLink(h, i+1)
        return {
          name:     c.capture(/(.+) \[DR/),
          kegg_id:  link.text,
          kegg_url: link.url,
        }
      })
    },

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
    },

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
    },

    reactions() {
      return this.headerLinks('Reaction').map(l => {
        return {
          identifier: l.text,
          url:        l.url,
        }
      })
    },

    enzymes() {
      return this.headerLinks('Enzyme').map(l => {
        return {
          identifier: l.text,
          url:        l.url,
        }
      })
    },

    reaction() {
      var h    = 'Reaction(IUBMB)'
      var link = this.headerLink(h)
      return {
        representation: this.hValue(h).capture(/(.+) \[RN/),
        kegg_id:        link.text,
        kegg_url:       link.url,
      }
    },

    headerLinks(h) {
      var links = this.rowSelectAll(h, {selector: 'td a'})
      return links.map(l => this.link(l))
    },

    headerLink(h, i = 1) {
      return this.rowLink(this.row(h), i)
    },

    rowLink(row, i = 1) {
      var link = row.querySelector(`a:nth-of-type(${i})`)
      return this.link(link)
    },

    link(el) {
      var url = el.href.startsWith('/') ? `${kegg.baseUrl}${el.href}` : el.href
      return {
        text: el.innerText,
        url:  url,
      }
    },

    linkFor(type, id) {
      return `${kegg.baseUrl}/dbget-bin/www_bget?${type.id}:${id}`
    },

    rowValue(row, i = 1, {selector = `td:nth-of-type(${i})`} = {}) {
      return this.text(row.querySelector(selector))
    },

    hValue(h, {selector = 'td'} = {}) {
      return this.text(this.rowSelect(h, {selector: selector}))
    },

    rowSelect(h, {selector = 'td'} = {}) {
      var row = this.row(h)
      if (!row) return 
      return row.querySelector(selector)
    },
    rowSelectAll(h, {selector = 'td table'} = {}) {
      var row = this.row(h)
      if (!row) return []
      return row.querySelectorAll(selector)
    },

    rows(h) {
      return kegg.table.querySelectorAll(`tr:contains('${h}')`)
    },

    subrow(h, sh, i = 1) {
      return kegg.table.querySelector(`tr:contains('${h}'):nth-of-type(${i}) + tr:contains('${sh}')`)
    },

    row(h) {
      return kegg.table.querySelector(`tr:contains('${h}')`)
    },

    text(el) {
      if (!el) return ''
      return el.innerText.trim()
    },

  },

}

