const ftp       = require('basic-ftp')
const fs        = require('fs')
const path      = require('path')
const csvParser = require('csv-parser')
const tar       = require('tar-stream')
const zlib      = require('zlib')
const query     = require('querystring')
const async     = require('async')

pubmed = {

  async database() {
    return new Promise(async (resolve) => {
      await this.ftp.init()
      await this.ftp.downloadCsv()
      await this.article.readCsv()
    })
  },

  article: {

    queue:      0,
    queueLimit: 200,

    baseUrl: 'https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi',

    parse(xml) {
      //nxml = new xmldom.DOMParser().parseFromString(nxml, 'text/xml')
    },

    async cacheFromOai(row) {
      var id     = row['Accession ID'].replace(/^PMC/, '')
      var dir    = `${pubmed.ftp.cacheDir}/articles`
      var file   = `${dir}/${id}.nxml`
      if (fs.existsSync(file))
        return Promise.resolve(fs.readFileSync(file))

      var params = {
        verb:           'GetRecord',
        identifier:     `oai:pubmedcentral.nih.gov:${id}`,
        metadataPrefix: 'pmc',
      }
      var url    = `${this.baseUrl}?${query.stringify(params)}`

      return fetch(url).then(response => response.text()).then(xml => {
        fs.writeFile(file, xml, () => {})
      })
    },

    async cacheFromTar(row) {
      var id   = row['Accession ID'].replace(/^PMC/, '')
      var dir  = `${pubmed.ftp.cacheDir}/articles`
      var file = `${dir}/${id}.nxml`
      if (fs.existsSync(file))
        return Promise.resolve(fs.readFileSync(file))

      var tmp  = `/tmp/${path.basename(row.File)}`
      await pubmed.ftp.download(tmp, `/pub/pmc/${row.File}`)

      return this.extract(tmp).then(nxml => {
        fs.unlink(tmp, () => {})
        fs.writeFile(file, nxml, () => {})
      })
    },

    async extract(file) {
      var nxml    = ''
      var extract = tar.extract()

      fs.createReadStream(file)
        .pipe(zlib.createGunzip())
        .pipe(extract)

      extract.on('entry', (header, stream, cb) => {
        stream.on('data', chunk => {
          if (header.name.endsWith('.nxml')) nxml += chunk
        })
        stream.on('end', cb)
        stream.resume()
      })

      return new Promise(resolve => {
        extract.on('finish', () => {
          resolve(nxml)
        })
      })
    },

    async readCsv() {
      var stream = fs.createReadStream(`${pubmed.ftp.cacheDir}/${pubmed.ftp.csvFile}`)
        .pipe(csvParser())
        .on('data', async (row) => {
          if (this.queue++ > this.queueLimit) stream.pause()
          puts(`Caching ${row['Accession ID']}`)
          await pubmed.article.cacheFromOai(row).then(pubmed.article.parse)
          if (this.queue-- < this.queueLimit) stream.resume()
        })
    },

  },

  ftp: {
    client: null,
    config: {
      host: `ftp.ncbi.nlm.nih.gov`,
    },

    csvFile:  `oa_file_list.csv`,
    cacheDir: `cache/pubmed`,

    async newClient() {
      const client = new ftp.Client()
      client.ftp.verbose = true
      await client.access(this.config)
      return client
    },

    async init() {
      this.client = await this.newClient()
    },

    async downloadCsv() {
      await this.download(`${this.cacheDir}/${this.csvFile}`, `/pub/pmc/${this.csvFile}`)
    },

    async download(localPath, remotePath) {
      const lastMod   = fs.existsSync(localPath) && await this.client.lastMod(remotePath)
      const localStat = lastMod && fs.statSync(localPath)
      if (localStat == false || lastMod > localStat.mtime)
        await this.client.downloadTo(localPath, remotePath)
    },

  },

}

