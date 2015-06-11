/* global Buffer */
var array = require('stream-array');
var File = require('gulp-util').File;

module.exports = function () {
  var args = Array.prototype.slice.call(arguments);

  var i = 0;

  function create(contents) {
    if (typeof contents !== 'string') {
      contents = JSON.stringify(contents);
    }
    
    return new File({
      cwd: '/home/contra/',
      base: '/home/contra/test',
      path: '/home/contra/test/file' + (i++).toString() + '.json',
      contents: new Buffer(contents),
      stat: {mode: 0666}
    });
  }

  return array(args.map(create));
};