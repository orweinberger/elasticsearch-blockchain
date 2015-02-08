var helper = require('./lib/common'),
  yaml = require('js-yaml'),
  fs = require('fs'),
  config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

var totalblocks;

var address_cache = [];



setInterval(function () {
  console.log('clearing address cache', address_cache.length);
  if (address_cache > 0)
    address_cache = helper.arrayUnique(address_cache);
  if (address_cache.length > 1000) address_cache = address_cache.slice(address_cache.length - 1000, 1000);
}, 30000);

function preflight() {
  helper.getInsightBlockCount(function (err, result) {
    if (err) throw err;
    totalblocks = parseInt(result);
    helper.getLastHeight(function (err, height) {
      if (err) throw err;
      if (totalblocks > height)
        run(height);
      else retry(height, 600000);
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
          if (address_cache.indexOf(in_address) === -1) {
            address_cache.push(in_address);
            helper.getAddress(in_address, function (err, addr) {
              if (err) throw new Error(err);
              if (addr) {
                helper.cleanupaddress(addr, function (data) {
                  var in_doc = {
                    index: 'addresses',
                    type: 'addr',
                    id: data.addrStr,
                    body: data
                  };
                  helper.pushToElastic(in_doc, function (err) {
                    if (err) throw new Error(err);
                  });
                });
              }
            });
          }
        });

        t.out_addresses.forEach(function (out_address) {
          if (address_cache.indexOf(out_address) === -1) {
            address_cache.push(out_address);
            helper.getAddress(out_address, function (err, addr) {
              if (err) throw new Error(err);
              helper.cleanupaddress(addr, function (data) {
                var out_doc = {
                  index: 'addresses',
                  type: 'addr',
                  id: data.addrStr,
                  body: data
                };
                helper.pushToElastic(out_doc, function (err) {
                  if (err) throw new Error(err);
                });
              });
            });
          }
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
    helper.cleanupblock(doc, function (block) {
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
