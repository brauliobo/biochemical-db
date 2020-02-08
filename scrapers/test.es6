require('../lib/string.es6')
require('../lib/xml2json.es6')
require('../lib/puts.es6')
require('../lib/args.es6')
require('../lib/cache.es6')
require('../lib/fetch.es6')
Data  = require('../lib/data.es6')
Queue = require('../lib/queue.es6')

xmldom = require('xmldom')
_      = require('lodash')

require('./expasy/expasy.es6')
require('./kegg/kegg.es6')
require('./uniprot/uniprot.es6')
require('./pubmed/pubmed.es6')

data = new Data(args.source)

global[args.source][args.type](args.id).then(puts)


