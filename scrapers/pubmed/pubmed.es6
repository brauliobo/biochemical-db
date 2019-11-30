pubmed = {

  async database() {
    return new Promise(async (resolve) => {
      await this.ftp.init()
      await this.ftp.downloadCsv()
      this.h.readCsv()
    })
  },

  ftp: {
    client: null,
    config: {
      host: `ftp.ncbi.nlm.nih.gov`,
    },
    csvFile:       `oa_file_list.csv`,
    remoteCsvPath: `/pub/pmc/oa_file_list.csv`,
    localCsvPath:  `cache/pubmed/oa_file_list.csv`,

    async init() {
      this.client = new ftp.Client()
      this.client.ftp.verbose = true
      await this.client.access(this.config)
    },

    downloadCsv() {
      this.download(this.localCsvPath, this.remoteCsvPath)
    },

    async download(localPath, remotePath) {
      const lastMod   = await this.client.lastMod(remotePath)
      const localStat = fs.existsSync(localPath) && fs.statSync(localPath)
      if (localStat == false || lastMod > localStat.mtime)
        await this.client.downloadTo(localPath, remotePath)
    },
  },

  h: {

    readCsv() {
      fs.createReadStream(pubmed.ftp.localCsvPath).pipe(csvParser()).on('data', this.process)
    },

    process(row) {
      puts(row)
    },

  },

}

