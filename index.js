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
      console.log('error at:', height, err);
      return run(height + 1);
    }
    doc.txinfo.forEach(function (tx) {
      helper.cleanuptx(tx, function (t) {
        t.in_addresses.forEach(function (in_address) {
          helper.getBalance(in_address, function (err, balance) {
            if (err) throw new Error(err);
            var in_doc = {
              index: 'addresses',
              type: 'addr',
              id: in_address,
              body: {"balance": balance}
            };
            helper.pushToElastic(in_doc, function (err) {
              if (err) throw new Error(err);
            })
          })
        });

        t.out_addresses.forEach(function (out_address) {
          helper.getBalance(out_address, function (err, balance) {
            if (err) throw new Error(err);
            var in_doc = {
              index: 'addresses',
              type: 'addr',
              id: out_address,
              body: {"balance": balance}
            };
            helper.pushToElastic(in_doc, function (err) {
              if (err) throw new Error(err);
            })
          })
        });

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
    helper.cleanupblock(doc, function(block) {
      var blockdoc = {
        index: 'blocks',
        type: 'block',
        id: block.hash,
        body: block
      };
      helper.pushToElastic(blockdoc, function (err) {
        if (err) throw new Error(err);
        console.log('pushed block: ', block.hash, height);
        if (totalblocks >= height + 1)
          return run(height + 1);
        else retry(height + 1, 600000);
      });
    });
  });
}


helper.init(config, function () {
  preflight();
});
