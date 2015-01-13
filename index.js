var helper = require('./lib/common'),
  yaml = require('js-yaml'),
  fs = require('fs'),
  config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));

var totalblocks;

function run(height) {
  helper.getData(height, function (err, doc) {
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
    helper.es.index({
      index: 'blocks',
      type: 'block',
      id: doc.hash,
      body: doc}, function (err, res) {
      console.log('pushed block: ', doc.hash, height);
      if (totalblocks > height + 1)
        return run(height + 1);
      else
        return console.log('DONE!');
    });
  });
}

helper.init(config, function () {
  helper.client.getBlockCount(function (err, result) {
    if (err) throw err;
    totalblocks = parseInt(result);
    helper.getLastHeight(function (err, height) {
      if (err) throw err;
      if (totalblocks > height)
        run(height);
    });
  });
});
