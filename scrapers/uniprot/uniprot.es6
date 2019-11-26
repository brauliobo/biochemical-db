uniprot = {

  baseUrl: `https://www.uniprot.org/uniprot`,
  data:    null,

  enzyme(id) {
    var url = `${this.baseUrl}/${id}.xml`
    return new Promise(resolve => {
      fetch(url).then(response => response.text()).then(xml => {
        xml = new xmldom.DOMParser().parseFromString(xml, 'text/xml')
        d   = this.data = xml2json(xml).entry

        resolve({
          identifier: d.accession.content, 
          number:     d.protein.recommendedName.ecNumber.content,
          names:      [d.protein.recommendedName.fullName.content],
          url:        url,
          gene:       d.gene.children[0].content,
          references: this.h.references(),
        })
      })
    })
  },

  h: {

    references() {
      return uniprot.data.children.filter(c => c.name == 'reference').map(r => {
        var cit = r.citation
        var pm  = cit.children.filter(c => c.name == 'dbReference' && c.attributes.type == 'PubMed')[0]
        var doi = cit.children.filter(c => c.name == 'dbReference' && c.attributes.type == 'DOI')[0]
        return {
          title:     cit.title.content,
          authors:   cit.authorList.children.map(p => p.attributes.name),
          tissue:    r.source ? r.source.tissue.content : null,
          pubmeb_id: pm  ? pm.attributes.id  : null,
          doi_id:    doi ? doi.attributes.id : null,
        }
      })
    },

  },

}

