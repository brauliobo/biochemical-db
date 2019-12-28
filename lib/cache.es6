const { exec } = require('child_process')

cache = {

  setupDir(dir) {
    var path = `cache/${dir}`
    exec(`mkdir -p ${path}`)
    return path
  },

}

