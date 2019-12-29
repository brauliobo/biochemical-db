const { exec } = require('child_process')

data = {

  types: [
    'compound',
    'reaction',
    'enzyme',
    'disease',
    'article',
  ],

  setupDir(dir) {
    var path = `data/${dir}`
    exec(`mkdir -p ${path}/{${this.types.join(',')}}`)
    return path
  },

  emit(type, data, resolve) {
    stream.emit(type, data)
    if (resolve) resolve(data)
  },

  save({source, type, obj} = {}) {

  },

}

