fetch        = require('node-fetch')
const fs     = require('fs')
const crypto = require('crypto')

fetchCached = (url, {file} = {}) => {
  file      = file || crypto.createHash('md5').update(url).digest("hex")
  var path  = `${cache.setupDir('fetch')}/${file}`

  if (fs.existsSync(path))
    return Promise.resolve(fs.readFileSync(path, 'utf8'))

  return fetch(url).then(response => {
    return new Promise(resolve => {
      response.text().then(body => {
        fs.writeFile(path, body, () => {})
        resolve(body)
      })
    })
  })
}
