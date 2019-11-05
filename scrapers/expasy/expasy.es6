const osmosis = require('osmosis')

expasy = {

  original: {

    enzyme(id) {
      var url = `https://enzyme.expasy.org/cgi-bin/enzyme/get-enzyme-entry?${id}`
      return new Promise(resolve => {
        osmosis.get(url)
          .find('pre')
          .then(pre => {
            resolve({
              identifier: pre.text().match(/ID\s+(.+)\n?/)[1],
              names:      pre.text().match(/DE\s+([^.]+)\.?\n?/)[1],
              reaction:   pre.text().scan( /CA\s+(.+)\n/g).join(' '),
              cofactor:   pre.text().match(/CF\s+([^.]+)\.?\n?/)[1],
              uniprot_id: pre.text().match(/DR\s+.*\s(Q\d+),[^_]+_HUMAN;\n?/)[1],
            })
          })
      })
    },

  },

  nicezyme: {
  },

}

expasy = {...expasy, ...expasy.original}

