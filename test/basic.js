var assert = require("assert");
var common = require('../lib/common');

describe('bitcoin-core', function () {
  it('should connect to the bitcoin-core RPC server', function () {
    common.client.getBalance('*', 6, function (err, result) {
      if (err) throw err;
      assert.equal(0, result);
    });
  });
  it('should successfully fetch the genesis block', function () {
    common.client.getBlockHash(0, function (err, result) {
      if (err) throw err;
      assert.equal('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', result);
    });
  });
  it('should successfully parse a block', function (done) {
    common.getData(1, function (err, result) {
      if (err) throw err;
      if (result.hash === '00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048' && result.txinfo.length === 1)
        return done();
      else
        return done(new Error('Could not verify block'));
    });
  });
  it('should successfully parse a block with multiple transactions', function (done) {
    common.getData(100000, function (err, result) {
      if (err) throw err;
      if (result.hash === '000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506' && result.txinfo.length === 4)
        return done();
      else
        return done(new Error('Could not verify block'));
    });
  });
});

describe('elasticSearch', function () {
  it('should connect to an elasticsearch server', function (done) {
    common.es.ping({
      requestTimeout: 1000,
      hello: "elasticsearch!"
    }, function (error) {
      return done(error);
    });
  });
  it('should insert a single block into ElasticSearch', function (done) {
    common.getData(1, function (err, doc) {
      if (err) return done(err);
      doc.txcount = doc.txinfo.length;
      doc.isotime = new Date(doc.time * 1000).toISOString();
      doc._timestamp = {
        "enabled": true,
        "path": "isotime"
      };
      doc.txcount = doc.txinfo.length;
      common.es.index({
        index: 'blocks_test',
        type: 'block',
        id: doc.hash,
        body: doc}, function (err) {
        return done(err);
      });
    });
  });

  it('should return the correct number of transaction for a given block that was inserted into Elasticsearch', function (done) {
    common.es.get({
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
    common.es.indices.delete({index: 'blocks_test'}, function (err) {
      if (err) return done(err);
      return done();
    });
  });
});
