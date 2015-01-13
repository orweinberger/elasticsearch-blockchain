var helper = require('../lib/common'),
  yaml = require('js-yaml'),
  fs = require('fs'),
  assert = require('assert'),
  config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

describe('bitcoin-core', function () {
  before(function (done) {
    helper.init(config, function () {
      done();
    });
  });
  it('should connect to the bitcoin-core RPC server', function (done) {
    helper.client.getBalance('*', 6, function (err) {
      done(err);
    });
  });
  it('should successfully fetch the genesis block', function () {
    helper.client.getBlockHash(0, function (err, result) {
      if (err) throw err;
      assert.equal('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', result);
    });
  });
  it('should successfully parse a block', function (done) {
    helper.getData(1, function (err, result) {
      if (err) throw err;
      if (result.hash === '00000000839a8e6886ab5951d76f411475428afc90947ee320161bbf18eb6048' && result.txinfo.length === 1)
        return done();
      else
        return done(new Error('Could not verify block'));
    });
  });
  it('should successfully parse a block with multiple transactions', function (done) {
    helper.getData(100000, function (err, result) {
      if (err) throw err;
      if (result.hash === '000000000003ba27aa200b1cecaad478d2b00432346c3f1f3986da1afd33e506' && result.txinfo.length === 4)
        return done();
      else
        return done(new Error('Could not verify block'));
    });
  });
});