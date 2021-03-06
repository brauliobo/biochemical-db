_fetch       = require('node-fetch')
const fs     = require('fs')
const crypto = require('crypto')

const dir   = cache.setupDir('fetch')
fetchCached = (url, {file} = {}) => {
  file      = file || crypto.createHash('md5').update(url).digest("hex")
  var path  = `${dir}/${file}`

  if (fs.existsSync(path)) {
    console.log(`CACHE-GET: ${url}`)
    return Promise.resolve(fs.readFileSync(path, 'utf8'))
  }

  return fetch(url).then(response => {
    return new Promise(resolve => {
      response.text().then(body => {
        fs.writeFileSync(path, body)
        resolve(body)
      })
    })
  })
}

fetch = (url) => _fetch(url).then(response => {
  console.log(`GET ${url}`)
  if (!response.ok)
    throw Error(`${url}: Failed with ${response.statusText}`)
  return response
})

