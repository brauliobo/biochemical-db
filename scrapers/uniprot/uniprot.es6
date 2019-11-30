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
          cofactor:   this.h.cofactor(),
          reaction:   this.h.comment('catalytic activity').reaction.text.content,
          gene:       d.gene.name.content,
          sequence:   d.sequence.content,
          pathways:   this.h.comments('pathway').flatMap(c => c.text.content.split('; ')),
          references: this.h.references(),
          cross_refs: this.h.crossRefs(),
          evidences:  this.h.evidences(),
        })
      })
    })
  },

  h: {

    comment(type) {
      return this.comments(type)[0]
    },

    comments(type) {
      return uniprot.data.children.filter(c => c.attributes.type == type)
    },

    cofactor() {
      var el = this.comment('cofactor').cofactor
      return {
        name:     el.name.content,
        chebi_id: el.dbReference.attributes.id.match(/CHEBI:(\d+)/)[1],
      }
    },

    sourceMap: {
      PDB:               'pdb_id',
      UniProtKB:         'uniprotkb_id',
      'PROSITE-ProRule': 'prorule_id',
      PubMed:            'pubmed_id',
      DOI:               'doi_id',
      EMBL:              'embl_id',
    },

    dbRef(ref) {
      var mapped = this.sourceMap[ref.attributes.type] || ref.attributes.type
      return {
        [mapped]: ref.attributes.id,
      }
    },

    references() {
      return uniprot.data.children.filter(c => c._name == 'reference').flatMap(r => {
        var cit = r.citation
        var ret = {
          title:     cit.title.content,
          authors:   cit.authorList.children.map(p => p.attributes.name),
          tissue:    r.source ? r.source.tissue.content : null,
        }
        cit.children.filter(c => c._name == 'dbReference').forEach(db => _.assign(ret, this.dbRef(db)))
        return ret
      })
    },

    crossRefs() {
      return uniprot.data.children.filter(c => c._name == 'dbReference').reduce((h, db) => {
        _.assign(h, this.dbRef(db))
        return h
      }, {})
    },

    evidences() {
      return uniprot.data.children.filter(c => c._name == 'evidence').map(e => {
        return this.dbRef(e.source.dbReference)
      })
    },

  },

}

