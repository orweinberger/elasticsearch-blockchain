var helper = require('./lib/common'),
  yaml = require('js-yaml'),
  fs = require('fs'),
  config = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));
helper.init(config, function() {
  helper.getBalance('2N66DDrmjDCMM3yMSYtAQyAqRtasSkFhbmX', function(err, balance) {
    console.log(err,balance);
  })  
})
