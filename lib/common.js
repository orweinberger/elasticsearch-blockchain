var bitcoin = require('bitcoin'),
  elasticsearch = require('elasticsearch'),
  async = require('async');

var helper = module.exports;

helper.init = function (options, cb) {
  helper.es = new elasticsearch.Client({
    host: options.elasticsearch.host
  });
  helper.client = new bitcoin.Client({
    host: options.bitcoind.host,
    port: options.bitcoind.port,
    user: options.bitcoind.username,
    pass: options.bitcoind.password
  });
  if (cb)
    cb();
  return helper;
};

exports.getData = function (height, cb) {
  var doc = {};
  async.waterfall([
    function (callback) {
      helper.client.getBlockHash(height, function (err, data) {
        if (err)
          callback(err);
        callback(null, data);
      });
    },
    function (blockhash, callback) {
      helper.client.getBlock(blockhash, function (err, block) {
        if (err)
          return callback(err);
        doc = block;
        doc.txinfo = [];
        callback(null, block);
      });
    },
    function (block, callback) {
      async.mapSeries(block.tx, function (tx, mapcallback) {
        helper.client.getRawTransaction(tx, function (err, t) {
          if (t) {
            helper.client.decodeRawTransaction(t, function (err, tx) {
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
  helper.es.indices.exists({
    index: 'blocks'
  }, function (err, result) {
    if (err)
      return cb(err);
    if (result === false)
      return cb(null, 0);
    if (result === true) {
      helper.es.search({
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