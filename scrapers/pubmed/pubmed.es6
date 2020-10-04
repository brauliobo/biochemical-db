const ftp       = require('basic-ftp')
const fs        = require('fs')
const path      = require('path')
const csvParser = require('csv-parser')
const tar       = require('tar-stream')
const zlib      = require('zlib')
const query     = require('querystring')
const libxml    = require('libxmljs-dom')

pubmed = {

  articlesDir: `cache/pubmed/articles`,
  searchIndex: new Index('articles'),
  indexQueue:  new Queue(10000),

  database() {
    return new Promise(async (resolve) => {
      await this.ftp.init()
      await this.ftp.downloadCsv()
      await this.articles.readCsv()
    })
  },

  async index(id) {
    await this.article(id).then(async obj => {
      await this.searchIndex.index(obj)
    }).catch((e) => puts(`${id}: ${e}`))
  },

  async indexAll() {
    await this.searchIndex.connect()
    for await (const f of fs.readdirSync(this.articlesDir)) {
      var id = f.split('.').slice(0, -1).join('.')
      await this.indexQueue.enqueue(() => this.index(id))
    }
  },

  article(id) {
    var xml = fs.readFileSync(`${this.articlesDir}/${id}.nxml`, 'utf8')
    //parseHtml doesnt work with a <body> tag
    var doc = libxml.parseHtmlFragment(xml, {huge: true})
    if (!doc.querySelector('article'))
      throw '<article> tag not found'

    var title    = doc.querySelector('article-title')
    var abstract = doc.querySelector('abstract')
    var body     = doc.querySelector('body')
    var obj = {
      id:       id,
      title:    title ? title.innerText.trim() : null,
      abstract: abstract ? abstract.innerText.trim() : null,
      body:     body ? body.innerText.trim() : null,
    }
    return Promise.resolve(obj)
  },

  articles: {

    queue:      0,
    queueLimit: 50,

    baseUrl: 'https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi',

    async readCsv() {
      var stream = fs.createReadStream(`${pubmed.ftp.cacheDir}/${pubmed.ftp.csvFile}`)
        .pipe(csvParser())
        .on('data', async (row) => {
          if (this.queue++ > this.queueLimit) stream.pause()
          puts(`Caching ${row['Accession ID']}`)
          await pubmed.articles.cacheFromOai(row).then(pubmed.articles.parse)
          if (this.queue-- < this.queueLimit) stream.resume()
        })
    },

    async cacheFromOai(row) {
      var id     = row['Accession ID'].replace(/^PMC/, '')
      var dir    = `${pubmed.ftp.cacheDir}/articles`
      var file   = `${dir}/${id}.nxml`
      if (fs.existsSync(file))
        return file

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
        return file

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

