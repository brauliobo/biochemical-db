const ftp       = require('basic-ftp')
const fs        = require('fs')
const path      = require('path')
const csvParser = require('csv-parser')
const tar       = require('tar-stream')
const zlib      = require('zlib')
const AsyncLib  = require('async')

pubmed = {

  async database() {
    return new Promise(async (resolve) => {
      await this.ftp.init()
      await this.ftp.downloadCsv()
      this.ftp.readCsv()
    })
  },

  ftp: {
    client: null,
    config: {
      host: `ftp.ncbi.nlm.nih.gov`,
    },

    csvFile:  `oa_file_list.csv`,
    cacheDir: `cache/pubmed`,

    async init() {
      this.client = new ftp.Client()
      this.client.ftp.verbose = true
      await this.client.access(this.config)
    },

    async downloadCsv() {
      await this.download(`${this.cacheDir}/${this.csvFile}`, `/pub/pmc/${this.csvFile}`)
    },

    async download(localPath, remotePath) {
      const lastMod   = await this.client.lastMod(remotePath)
      const localStat = fs.existsSync(localPath) && fs.statSync(localPath)
      if (localStat == false || lastMod > localStat.mtime)
        await this.client.downloadTo(localPath, remotePath)
    },

    readCsv() {
      fs.createReadStream(`${pubmed.ftp.cacheDir}/${pubmed.ftp.csvFile}`)
        .pipe(csvParser())
        .on('data', row => {
          pubmed.article.cacheQueue.push(row)
        })
    },
  },

  article: {

    cacheQueue: AsyncLib.queue(async (row, cb) => {
      await pubmed.article.cache(row).then(nxml => {
        pubmed.article.read(nxml)
      })
      return cb()
    }, 1),

    read(nxml) {
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

