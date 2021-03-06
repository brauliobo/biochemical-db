const xmldom = require('xmldom')

xml2json = (xml, {ignoreTags = []} = {}) => {
  var el = xml.nodeType === 9 ? xml.documentElement : xml
  if (ignoreTags.includes(el.nodeName)) return el

  var h  = {_name: el.nodeName}
  h.content    = Array.from(el.childNodes || []).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('')
  h.attributes = Array.from(el.attributes || []).filter(a => a).reduce((h, a) => { h[a.name] = a.value; return h }, {})
  h.children   = Array.from(el.childNodes || []).filter(n => n.nodeType === 1).map(c => {
    var r = xml2json(c, {ignoreTags: ignoreTags})
    h[c.nodeName] = h[c.nodeName] || r
    return r
  })
  return h
}

xml2json_example = () => {
  var xml = `
  <uniprot xmlns="http://uniprot.org/uniprot">
    <entry dataset="Swiss-Prot" created="1997-11-01" modified="2019-10-16" version="179">
      <accession>Q93088</accession>
      <accession>Q9UNI9</accession>
      <name>BHMT1_HUMAN</name>
      <protein>
        <recommendedName>
          <fullName>Betaine--homocysteine S-methyltransferase 1</fullName>
          <ecNumber>2.1.1.5</ecNumber>
        </recommendedName>
      </protein>
    </entry>
  </uniprot>
  `
  xml = new xmldom.DOMParser().parseFromString(xml, 'text/xml')
  console.log(xml2json(xml))
}

