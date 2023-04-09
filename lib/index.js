const { Client } = require('@elastic/elasticsearch')

class Index {

  constructor(name) {
    this.name = name
    this.connect()
  }

  async connect() {
    this.client = new Client({ node: 'http://localhost:9200' })
    this.client.indices.create({index: this.name}).catch()
    await this.client.ping().then(a => {console.log('server ping')})
  }

  async hasId(id) {
    var count = 0
    await this.client.count({index: this.name, body: {query: {match: {id: id}}}}).then(async r => {
      count = r.body.count 
    })
    return count >= 1
  }

  async index(o) {
    puts(`${o.id}: indexing`)
    await this.client
      .index({id: o.id, index: this.name, body: o})
      .then( () => puts(`${o.id}: finished indexing`))
      .catch(() => puts(`${o.id}: failed to index`))

    if (parseInt(Math.random()*100) == 50)
      await this.client.indices.refresh({index: this.name})
  }

  search(query) {
    return this.client.search({index: this.name, body: {q: query}})
  }

  deleteAll() {
    return this.client.deleteByQuery({index: this.name, body: {query: {match_all: {}}}})
  }

}

module.exports = Index

