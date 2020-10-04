const { Client } = require('@elastic/elasticsearch')

class Index {

  constructor(name) {
    this.name   = name
  }

  async connect() {
    this.client = new Client({ node: 'http://localhost:9200' })
    this.client.indices.create({index: this.name}).catch(puts)
    await this.client.ping().then(a => {console.log('server ping')})
  }

  async index(o) {
    puts(`${o.id}: indexing`)
    await this.client
      .index({id: o.id, index: this.name, body: o})
      .then( () => puts(`${o.id}: finished indexing`))
      .catch(() => puts(`${o.id}: failed to index`))
  }

  search(query) {
    return this.client.search({index: this.name, q: query})
  }

  deleteAll() {
    return this.client.deleteByQuery({index: this.name, body: {query: {match_all: {}}}})
  }

}

module.exports = Index

