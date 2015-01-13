var helper = require('../lib/common'),
  yaml = require('js-yaml'),
  fs = require('fs'),
  config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

describe('elasticSearch', function () {
  before(function (done) {
    helper.init(config, function() {
      done();
    });
  });
  it('should connect to an elasticsearch server', function (done) {
    helper.es.ping({
      requestTimeout: 1000,
      hello: "elasticsearch!"
    }, function (error) {
      return done(error);
    });
  });
  it('should insert a single block into ElasticSearch', function (done) {
    helper.getData(1, function (err, doc) {
      if (err) return done(err);
      doc.txcount = doc.txinfo.length;
      doc.isotime = new Date(doc.time * 1000).toISOString();
      doc._timestamp = {
        "enabled": true,
        "path": "isotime"
      };
      doc.txcount = doc.txinfo.length;
      helper.es.index({
        index: 'blocks_test',
        type: 'block',
        id: doc.hash,
        body: doc}, function (err) {
        return done(err);
      });
    });
  });

  it('should return the correct number of transactions for a given block that was inserted into Elasticsearch', function (done) {
    helper.es.get({
      index: 'blocks_test',
      type: 'block',
      id: '00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048'
    }, function (err, response) {
      if (err) return done(err);
      if (response._source.txcount !== 1)
        return done(new Error('Got the wrong number of transactions'));
      done();
    });
  });
  after(function (done) {
    helper.es.indices.delete({index: 'blocks_test'}, function (err) {
      if (err) return done(err);
      return done();
    });
  });
});
