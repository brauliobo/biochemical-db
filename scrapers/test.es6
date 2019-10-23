var params = process.argv.slice(2).reduce((h, val, index) => {
  var p    = val.split('=')
  h[p[0]]  = p[1]
  return h
}, {})

global[params.source][params.type](params.id).then(console.log)

