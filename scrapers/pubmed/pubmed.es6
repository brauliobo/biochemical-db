pubmed = {

  ftp: {
    host: `ftp.ncbi.nlm.nih.gov`,
    port: 21,
    user: 'anonymous',
  },
  csvFile: `oa_file_list.csv`,
  remoteCsvPath: `/pub/pmc/oa_file_list.csv`,
  localCsvPath:  `cache/pubmed/oa_file_list.csv`,

  async database() {
    return new Promise(async (resolve) => {
      var client = new ftp.Client()
      client.ftp.verbose = true
      await client.access(this.ftp)
      const lastMod   = await client.lastMod(this.remoteCsvPath)
      const localStat = fs.existsSync(this.localCsvPath) && fs.statSync(this.localCsvPath)
      if (localStat == false || lastMod > localStat.mtime)
        await client.downloadTo(this.localCsvPath, this.remoteCsvPath)
    })
  },

}

