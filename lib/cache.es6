const { exec } = require('child_process')

cache = {

  setupDir(dir) {
    exec(`mkdir -p cache/${dir}`)
  },

}

