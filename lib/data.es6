const { exec }  = require('child_process')
const fs        = require('fs')
const yaml      = require('js-yaml')
const EvEmitter = require('events')

class Data {

  types = [
    'compound',
    'reaction',
    'enzyme',
    'disease',
    'article',
  ]

  constructor(source) {
    this.stream = new EvEmitter()
    this.setupDir(source)

    this.types.forEach(t => {
      this.stream.on(t, o => this.save(source, t, o.identifier, o))
    })
  }

  setupDir(source) {
    var path = `data/${source}`
    exec(`mkdir -p ${path}/{${this.types.join(',')}}`)
    return path
  }

  emit(type, data, resolve) {
    this.stream.emit(type, data)
    if (resolve) resolve(data)
  }

  save(source, type, id, obj) {
    var path = `data/${source}/${type}/${id}.yaml`
    fs.writeFileSync(path, yaml.dump(obj))
  }

}

module.exports = Data
