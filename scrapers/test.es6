require('../lib/all.es6')

xmldom = require('xmldom')
_      = require('lodash')

require(`./${args.source}/${args.source}.es6`)

if (args.action)
  return global[args.source][args.action](args.id)

data = new Data(args.source)
global[args.source][args.type](args.id).then((o) => {
  if (o) data.emit(args.type, o)
})


