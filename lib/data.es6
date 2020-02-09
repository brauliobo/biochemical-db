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
  batch = false

  constructor(source) {
    this.source = source
    this.stream = new EvEmitter()
    this.setupDir(source)

    this.types.forEach(t => {
      this.stream.on(t, o => {
        if (!this.batch) puts(o)
        this.save(t, o.identifier, o)
      })
    })
  }

  fetchWithCache(type, id) {
    if (data.batch && this.isCached(type.name, id)) {
      var obj = this.fromCache(type.name, id)
      this.emit(type.name, obj)
      puts(`${id}: fetched from cache`)
      return Promise.resolve(obj)
    }
    return Promise.resolve()
  }

  fromCache(type, id) {
    var content = fs.readFileSync(this.pathFor(type, id), 'utf8')
    return yaml.load(content)
  }

  isCached(type, id) {
    return fs.existsSync(this.pathFor(type, id))
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

  save(type, id, obj) {
    fs.writeFileSync(this.pathFor(type, id, obj), yaml.dump(obj))
  }
  
  pathFor(type, id, obj) {
    return `data/${this.source}/${type}/${id}.yaml`
  }

}

module.exports = Data
