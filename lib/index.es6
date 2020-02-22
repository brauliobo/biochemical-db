const elasticsearch = require('elasticsearch')

class Index {

  constructor(name) {
    this.name   = name
    this.client = new elasticsearch.Client({node: 'http://localhost:9200'})
  }

  index(obj) {
    return this.client.index({index: this.name, body: obj})
  }

  search(obj) {
    return this.client.search({index: this.name, body: obj})
  }

  deleteAll() {
    this.client.deleteByQuery({index: this.name, body: {query: {match_all: {}}}})
  }

}

module.exports = Index

