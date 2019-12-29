require('../lib/string.es6')
require('../lib/xml2json.es6')
require('../lib/puts.es6')
require('../lib/args.es6')
require('../lib/data.es6')
require('../lib/cache.es6')
require('../lib/fetch.es6')

xmldom          = require('xmldom')
_               = require('lodash')
const EvEmitter = require('events')

require('./expasy/expasy.es6')
require('./kegg/kegg.es6')
require('./uniprot/uniprot.es6')
require('./pubmed/pubmed.es6')

stream = new EvEmitter()
data.types.forEach(t => {
  stream.on('compound', puts)
  stream.on('reaction', puts)
  stream.on('enzyme', puts)
  stream.on('disease', puts)
})

data.setupDir(args.source)

global[args.source][args.type](args.id).then(puts)


