String.prototype.scan = function(regex) {
  var m, matches = []

  while (m = regex.exec(this))
    matches.push(m[1])

  return matches
}

String.prototype.capture = function(regex) {
  var matches = this.match(regex)
  if (matches) return matches[1]
}

