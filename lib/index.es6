const elasticsearch = require('elasticsearch')

class Index {

  constructor(name) {
    this.name   = name
    this.client = new elasticsearch.Client({node: 'http://localhost:9200'})
  }

  async index(obj) {
    return await this.client.index({index: this.name, body: obj, refresh: 'wait_for'})
  }

  search(query) {
    return this.client.search({index: this.name, q: query})
  }

  deleteAll() {
    return this.client.deleteByQuery({index: this.name, body: {query: {match_all: {}}}})
  }

}

module.exports = Index

