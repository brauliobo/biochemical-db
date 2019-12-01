const ftp       = require('basic-ftp')
const fs        = require('fs')
const path      = require('path')
const csvParser = require('csv-parser')
const tar       = require('tar-stream')
const zlib      = require('zlib')
const AsyncLib  = require('async')
const pool      = require('generic-pool')

pubmed = {

  async database() {
    return new Promise(async (resolve) => {
      this.ftp.init()
      await this.ftp.downloadCsv()
      this.ftp.readCsv()
    })
  },

  ftp: {
    pool:   null,
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

    init() {
      this.pool = pool.createPool({
        create:  () => this.newClient(),
        destroy: () => {},
      }, {min: 1, max: args.pool_size || 5})
    },

    async downloadCsv() {
      await this.download(`${this.cacheDir}/${this.csvFile}`, `/pub/pmc/${this.csvFile}`)
    },

    async download(localPath, remotePath) {
      await this.pool.acquire().then(async (client) => {
        const lastMod   = fs.existsSync(localPath) && await client.lastMod(remotePath)
        const localStat = lastMod && fs.statSync(localPath)
        if (localStat == false || lastMod > localStat.mtime)
          await client.downloadTo(localPath, remotePath)
        this.pool.release(client)
      })
    },

    readCsv() {
      fs.createReadStream(`${this.cacheDir}/${this.csvFile}`)
        .pipe(csvParser())
        .on('data', row => { pubmed.article.cache(row) })
    },
  },

  article: {

    parse(nxml) {
    },

    async cache(row) {
      var id   = row['Accession ID']
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

      try {
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
      } catch {
        return puts(`Ignoring ${file}`)
      }

      return new Promise(resolve => {
        extract.on('finish', () => {
          resolve(nxml)
        })
      })
    },

  },

}

