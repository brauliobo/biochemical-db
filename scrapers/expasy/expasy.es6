const osmosis = require('osmosis');

expasy = {

  enzyme(id) {
    var url = `https://enzyme.expasy.org/cgi-bin/enzyme/get-enzyme-entry?${id}`
    return new Promise(resolve => {
      osmosis.get(url)
        .find('pre')
        .then(pre => resolve({
          identifier: pre.text().match(/ID\s+(.+)\n/)[1],
          cofactor:   pre.text().match(/CF\s+(.+)\n/)[1],
        }))
    })
  },

}

