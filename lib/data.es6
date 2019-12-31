const { exec } = require('child_process')
const fs       = require('fs')
const yaml     = require('js-yaml')

data = {

  types: [
    'compound',
    'reaction',
    'enzyme',
    'disease',
    'article',
  ],

  setupDir(source) {
    var path = `data/${source}`
    exec(`mkdir -p ${path}/{${this.types.join(',')}}`)
    return path
  },

  emit(type, data, resolve) {
    stream.emit(type, data)
    if (resolve) resolve(data)
  },

  save(source, type, id, obj) {
    var path = `data/${source}/${type}/${id}.yaml`
    fs.writeFileSync(path, yaml.safeDump(obj))
  },

}

