const osmosis = require('osmosis')

kegg = {

  baseUrl: `https://www.genome.jp`,
  table:   null,

  enzyme(id) {
    var url = `${this.baseUrl}/dbget-bin/www_bget?ec:${id}`
    return new Promise(resolve => {
      osmosis.get(url)
        .find('form table table')
        .then(table => {
          if (table.index > 0) return
          this.table = table
          resolve({
            identifier: this.h.hValue('Entry').capture(/([\d\.]+)/),
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
    var url = `${this.baseUrl}/dbget-bin/www_bget?cpd:${id}`
    return new Promise(resolve => {
      osmosis.get(url)
        .find('form table table')
        .then(table => {
          if (table.index > 0) return
          this.table = table
          resolve({
            identifier: this.h.hValue('Entry').capture(/(C\d+)/),
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

  h: {
    db_links: {
      ExplorEnz: 'explorenz_url',
      IUBMB:     'iubmb_url',
      ExPASy:    'expasy_url',
      BRENDA:    'brenda_url',
    },
    db_ids: {

    },
    
    externalLinks() {
      var h = 'Other DBs'
      var refs = {}
      this.rowSelectAll(h).map((r,i) => {
        var v = this.rowValue(r, 1).split(/[, ]/)[0]
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
          pmid:    v.capture(/\[PMID:(\d+)\]/),
          doi_id:  journal.capture(/DOI:([\d\.\/()\-]+)/),
          authors: this.rowValue(this.subrow(h, 'Authors', i+1)).split(','),
          title:   this.rowValue(this.subrow('Authors', 'Title', i+1)),
          journal: journal,
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

