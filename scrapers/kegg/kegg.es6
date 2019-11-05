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
      this.rowElements(h).map((r,i) => {
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
      return this.rowElements(h).map(el => {
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

    reaction() {
      var h    = 'Reaction(IUBMB)'
      var link = this.headerLink(h)
      return {
        representation: this.hValue(h).capture(/(.+) \[RN/),
        kegg_id:        link.text,
        kegg_url:       link.url,
      }
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
      var row = this.row(h)
      if (!row) return ''
      return this.text(row.querySelector(selector))
    },

    rowElements(h, {selector = 'td table'} = {}) {
      var row = this.row(h)
      if (!row) return []
      return row.querySelectorAll(selector)
    },

    text(el) {
      return el.innerText.trim()
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

  },

}

