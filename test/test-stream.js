/* global Buffer */
var array = require('stream-array');
var File = require('gulp-util').File;

//Nifty wrapper for unit testing Vinyl streams by floatdrop
//https://github.com/wearefractal/gulp-concat/commit/eccffa49896a98c2527e3fd5445470918c05a2ca
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