var bitcoin = require('bitcoin'),
  elasticsearch = require('elasticsearch'),
  async = require('async'),
  request = require('request'),
  bitcore = require('bitcore');
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
  tx.isotime = new Date(tx.time * 1000).toISOString();
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
  if (tx.valueIn)
    tx.valueIn = tx.valueIn * 100000000;
  if (tx.valueOut)
    tx.valueOut = tx.valueOut * 100000000;
  if (tx.fees)
    tx.fees = tx.fees * 100000000;
  delete tx.vout;
  delete tx.vin;
  delete tx.blocktime;
  delete tx.time;
  return cb(tx);
};

exports.cleanupblock = function (block, cb) {
  block.txcount = block.txinfo.length;
  block.isotime = new Date(block.time * 1000).toISOString();
  delete block.txinfo;
  delete block.time;
  if (block.reward)
    block.reward = block.reward * 100000000;
  return cb(block);
};

exports.pushToElastic = function (doc, cb) {
  helper.es.index(doc, function (err) {
    if (err) return cb(err);
    return cb(null);
  });
};

exports.getAddress = function (address, cb) {
  if (bitcore.Address.isValid(address)) {
    request.get(insight_host + '/api/addr/' + address + '?noTxList=1', function (err, head, body) {
      if (err) return cb(err);
      try {
        var data = JSON.parse(body);
      }
      catch (e) {
        return cb(e);
      }
      return cb(null, data);
    });
  }
  else
    return callback(null, null);
};

exports.cleanupaddress = function (address, cb) {
  delete address.balance;
  delete address.totalReceived;
  delete address.totalSent;
  delete address.unconfirmedBalance;
  delete address.unconfirmedBalanceSat;
  delete address.unconfirmedTxApperances;
  delete address.transactions;
  address.txcount = address.txApperances;
  delete address.txApperances;
  return cb(address);
};