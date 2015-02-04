var helper = require('./lib/common'),
  yaml = require('js-yaml'),
  fs = require('fs'),
  config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

var totalblocks;

function preflight() {
  helper.getInsightBlockCount(function (err, result) {
    if (err) throw err;
    totalblocks = parseInt(result);
    helper.getLastHeight(function (err, height) {
      if (err) throw err;
      if (totalblocks > height)
        run(height + 1);
      else retry(height + 1, 600000);
    });
  });
}

function retry(height, delay) {
  console.log('Reached last block, sleeping for 10 minutes');
  setTimeout(function () {
    console.log('Resuming from block: ' + height);
    preflight();
  }, delay);
}

function run(height) {
  helper.getData(height, function (err, doc) {
    if (err) {
      console.log('error at:', height);
      return run(height + 1);
    }
    doc.txcount = doc.txinfo.length;
    doc.isotime = new Date(doc.time * 1000).toISOString();

    doc.txinfo.forEach(function (tx) {
      helper.cleanuptx(tx, function (t) {
        var txdoc = {
          index: 'transactions',
          type: 'tx',
          id: t.txid,
          body: t
        };
        helper.pushToElastic(txdoc, function (err) {
          if (err) throw new Error(err);
          console.log('pushed tx', t.txid, height);
        });
      });
    });
    delete doc.txinfo;
    delete doc.time;
    var blockdoc = {
      index: 'blocks',
      type: 'block',
      id: doc.hash,
      body: doc
    };
    helper.pushToElastic(blockdoc, function (err) {
      if (err) throw new Error(err);
      console.log('pushed block: ', doc.hash, height);
      if (totalblocks >= height + 1)
        return run(height + 1);
      else retry(height + 1, 600000);
    });
  });
}

helper.init(config, function () {
  preflight();
});
