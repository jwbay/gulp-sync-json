var gulp = require('gulp');
var through = require('through2');

function syncDirectory(primaryFile) {
	//todo: set .contents and push files back onto stream at the end of endStream
	var source;
	var targets = [];
	
	function addFiles(file, enc, done) {
		if (file.relative === primaryFile) {
			source = file;
		} else {
			targets.push(file);
		}
		done();
	}
	
	function processFiles(done) {
		var sourceKeys = fileToObject(source);
		var _this = this;
		targets.forEach(function (target) {
			var targetKeys = fileToObject(target);
			syncKeys(sourceKeys, targetKeys);
			target.contents = objectToBuffer(targetKeys);
			_this.push(target);
		});
		done();
	}
	
	function syncKeys(source, target) {
		var sourceKeys = Object.keys(source);
		
		sourceKeys.forEach(function (key) {
			//TODO error if object and string share prop name
			if (!target.hasOwnProperty(key)) {
				if (typeof source[key] === 'string') {
					target[key] = source[key];
				} else {
					target[key] = {};
					syncKeys(source[key], target[key]);
				}
			}
		});
	}
	
	function fileToObject(file) {
		var contents = file.contents.toString();
		if (contents) {
			return JSON.parse(contents);
		} 
		return {};
	}

	function objectToBuffer(object) {
		var contents = JSON.stringify(object, null, 4);
		return new Buffer(contents);
	}
	
	
	var stream = through.obj(addFiles, processFiles);
	return stream;
}

gulp.task('default', function () {
	return gulp.src('./test/*.json')
		.pipe(syncDirectory('en.json'))
		.pipe(gulp.dest('./test/'));
});