args = process.argv.slice(2).reduce((h, val, index) => {
  var a    = val.split('=')
  h[a[0]]  = a[1]
  return h
}, {})

