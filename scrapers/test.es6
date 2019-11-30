require('../lib/string.es6')
require('../lib/xml2json.es6')
require('../lib/puts.es6')

fetch     = require('node-fetch')
xmldom    = require('xmldom')
_         = require('lodash')
ftp       = require('basic-ftp')
fs        = require('fs')

require('./expasy/expasy.es6')
require('./kegg/kegg.es6')
require('./uniprot/uniprot.es6')
require('./pubmed/pubmed.es6')

var params = process.argv.slice(2).reduce((h, val, index) => {
  var p    = val.split('=')
  h[p[0]]  = p[1]
  return h
}, {})

global[params.source][params.type](params.id).then(puts)

