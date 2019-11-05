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
            identifier: this.h.value('Entry').capture(/([\d\.]+)/),
            names:      this.h.value('Name').split('\n').map(v => v.replace(/;$/,'')),
            sysname:    this.h.value('Sysname'),
            classes:    this.h.value('Class').split('\n').map(v => v.replace(/;$/,'')),
            reaction:   this.h.reaction(),
          })
        })
    })
  },

  h: {
    reaction() {
      var h = 'Reaction(IUBMB)'
      return {
        representation: this.value(h).capture(/(.+) \[RN/),
        kegg_id:        `${this.row(h).querySelector('a').innerText}`,
        kegg_url:       `${kegg.baseUrl}${this.row(h).querySelector('a').href}`,
      }
    },

    row(header) {
      return kegg.table.querySelector(`tr:contains('${header}')`)
    },

    value(header) {
      var row = this.row(header)
      if (!row) return ''
      return row.querySelector('td').innerText.trim()
    },

  },

}

