var bitcoin = require('bitcoin');
var elasticsearch = require('elasticsearch');
var async = require('async');
var yaml = require('js-yaml');
var fs = require('fs');
var config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

exports.es = new elasticsearch.Client({
  host: config.elasticsearch.host
});
exports.client = new bitcoin.Client({
  host: config.bitcoind.host,
  port: config.bitcoind.port,
  user: config.bitcoind.username,
  pass: config.bitcoind.password
});

var self = this;

exports.getData = function (height, cb) {
  var doc = {};
  async.waterfall([
    function (callback) {
      self.client.getBlockHash(height, function (err, data) {
        if (err)
          callback(err);
        callback(null, data);
      });
    },
    function (blockhash, callback) {
      self.client.getBlock(blockhash, function (err, block) {
        if (err)
          return callback(err);
        doc = block;
        doc.txinfo = [];
        callback(null, block);
      });
    },
    function (block, callback) {
      async.mapSeries(block.tx, function (tx, mapcallback) {
        self.client.getRawTransaction(tx, function (err, t) {
          if (t) {
            self.client.decodeRawTransaction(t, function (err, tx) {
              doc.txinfo.push(tx);
              mapcallback(err, tx);
            });
          }
          else {
            mapcallback();
          }
        });
      }, function (err) {
        callback(err);
      });
    }
  ], function (err) {
    if (err)
      return cb(err);
    cb(null, doc);
  });
};

exports.getLastHeight = function (cb) {
  self.es.indices.exists({
    index: 'blocks'
  }, function (err, result) {
    if (err)
      return cb(err);
    if (result === false)
      return cb(null, 0);
    if (result === true) {
      self.es.search({
        index: 'blocks',
        body: {
          "aggregations": { "max_height": { "max": { "field": "height" }}}
        }
      }, function (err, result) {
        if (err)
          return cb(err);
        return cb(null, result.aggregations.max_height.value);
      });
    }
  });
};