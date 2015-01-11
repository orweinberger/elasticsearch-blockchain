var common = require('./lib/common');

function run(height) {
  common.getData(height, function (err, doc) {
    if (err) {
      console.log('error at:', height);
      return run(height + 1);
    }
    doc.txcount = doc.txinfo.length;
    doc.isotime = new Date(doc.time * 1000).toISOString();
    doc._timestamp = {
      "enabled": true,
      "path": "isotime"
    };
    doc.txcount = doc.txinfo.length;
    common.es.index({
      index: 'blocks',
      type: 'block',
      id: doc.hash,
      body: doc}, function (err, res) {
      console.log('pushed block: ', doc.hash, height);
      return run(height + 1);
    });

  });
}

common.getLastHeight(function (err, height) {
  if (err)
    throw err;
  run(height);
});
