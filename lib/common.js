var bitcoin = require('bitcoin'),
  elasticsearch = require('elasticsearch'),
  async = require('async'),
  request = require('request');
var helper = module.exports;
var insight_host;
helper.init = function (options, cb) {
  insight_host = options.insight.host;
  helper.es = new elasticsearch.Client({
    host: options.elasticsearch.host
  });
  if (cb)
    cb();
  return helper;
};

exports.getInsightBlockCount = function (cb) {
  request.get(insight_host + '/api/sync', function (err, head, body) {
    try {
      var json = JSON.parse(body);
      return cb(null, json.blockChainHeight);
    }
    catch (e) {
      return cb(e);
    }
  });
};

exports.getData = function (height, cb) {
  var doc = {};
  async.waterfall([
    function (callback) {
      request.get(insight_host + '/api/block-index/' + height, function (err, head, body) {
        if (err)
          callback(err);
        try {
          var json = JSON.parse(body);
          callback(null, json.blockHash);
        }
        catch (e) {
          return callback(e);
        }
      });
    },
    function (blockhash, callback) {
      request.get(insight_host + '/api/block/' + blockhash, function (err, head, body) {
        if (err)
          return callback(err);
        try {
          doc = JSON.parse(body);
          doc.txinfo = [];
          callback(null, doc);
        }
        catch (e) {
          return callback(e);
        }
      });
    },
    function (block, callback) {
      async.mapSeries(block.tx, function (tx, mapcallback) {
        request.get(insight_host + '/api/tx/' + tx, function (err, head, body) {
          if (err)
            return mapcallback(err);
          try {
            doc.txinfo.push(JSON.parse(body));
            mapcallback(err, JSON.parse(body));
          }
          catch (e) {
            return mapcallback(e);
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

exports.cleanuptx = function (tx, cb) {
  tx.isotime = new Date(t.time * 1000).toISOString();
  tx.in_addresses = [];
  tx.out_addresses = [];
  if (!tx.vin[0].coinbase) {
    tx.isCoinBase = false;
    tx.vin.forEach(function (vin) {
      tx.in_addresses.push(vin.addr);
    });
  }

  tx.vout.forEach(function (vout) {
    vout.scriptPubKey.addresses.forEach(function (addr) {
      tx.out_addresses = tx.out_addresses.concat(addr);
    });
  });
  tx.in_addresses_count = tx.in_addresses.length;
  tx.out_addresses_count = tx.out_addresses.length;
  delete tx.vout;
  delete tx.vin;
  delete tx.blocktime;
  delete tx.time;
  return cb(tx);
};

exports.pushToElastic = function (doc, cb) {
  helper.es.index(doc, function (err) {
    if (err) return cb(err);
    return cb(null);
  });
};