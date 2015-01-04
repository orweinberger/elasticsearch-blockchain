var bitcoin = require('bitcoin');
var elasticsearch = require('elasticsearch');
var async = require('async');
var es = new elasticsearch.Client({
  host: 'localhost:9200'
});
var client = new bitcoin.Client({
  host: 'localhost',
  port: 8332,
  user: 'YOUR-RPC-USERNAME',
  pass: 'YOUR-RPC-PASSWORD',
  timeout: 30000
});
function getData(height, cb) {
  var doc = {};
  async.waterfall([
    function (callback) {
      client.getBlockHash(height, function (err, data) {
        if (err)
          callback(err);
        callback(null, data);
      });
    },
    function (blockhash, callback) {
      client.getBlock(blockhash, function (err, block) {
        if (err)
          return callback(err);
        doc = block;
        doc.txinfo = [];
        callback(null, block);
      });
    },
    function (block, callback) {
      async.mapSeries(block.tx, function (tx, mapcallback) {
        client.getRawTransaction(tx, function (err, t) {
          if (t) {
            client.decodeRawTransaction(t, function (err, tx) {
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
}

function getLastHeight(cb) {
  es.indices.exists({
    index: 'blocks'
  }, function (err, result) {
    if (err)
      return cb(err);
    console.log(result);
    if (result === false)
      return cb(null, 0);
    if (result === true) {
      es.search({
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
}

function run(height) {
  getData(height, function (err, doc) {
    if (err) {
      console.log('error at:', height);
      return run(height + 1);
    }
    doc.isotime = new Date(doc.time * 1000).toISOString();
    doc._timestamp = {
      "enabled": true,
      "path": "isotime"
    };

    es.index({
      index: 'blocks',
      type: 'block',
      id: doc.hash,
      body: doc}, function (err, res) {
      console.log('pushed block: ', doc.hash, height);
      return run(height + 1);
    });

  });
}

getLastHeight(function (err, height) {
  if (err)
    throw err;
  run(height);
});
