const {Client} = require('@elastic/elasticsearch')

class Index {

  constructor(name) {
    this.name   = name
    this.client = new Client({node: 'http://localhost:9200'})
  }

  index(obj) {
    return this.client.index({index: this.name, body: obj})
  }

  search(obj) {
    return this.client.search({index: this.name, body: obj})
  }

}

module.exports = Index

