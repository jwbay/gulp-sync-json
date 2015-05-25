/* global Buffer */
var gulp = require('gulp');
var gutil = require('gulp-util');
var through = require('through2');
var PluginError = gutil.PluginError;
var log = gutil.log;

'use strict';

var pluginName = 'sync-l10n';

function syncDirectory(primaryFile) {
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
		var _this = this;
		var sourceKeys = bufferToObject(source.contents);
		var resultMap = {};

		source.contents = objectToBuffer(sourceKeys);
		_this.push(source);

		targets.forEach(function (target) {
			var fileName = target.path.replace(target.cwd, '');
			var targetKeys = bufferToObject(target.contents);
			resultMap[target.path] = sync(sourceKeys, targetKeys, fileName);
			target.contents = objectToBuffer(targetKeys);
		});

		targets.forEach(function(target) {
			var fileName = target.path.replace(target.cwd, '');
			var result = resultMap[target.path];
			if (result.pushed.length) {
				log('Pushed to', gutil.colors.cyan(fileName) + ':', getResultString(result.pushed));
			}
			if (result.removed.length) {
				log('Removed from', gutil.colors.cyan(fileName) + ':', getResultString(result.removed));
			}
			_this.push(target);
		});

		done();
	}

	function sync(source, target, fileName) {
		var pushedKeys = [];
		var removedKeys = [];
		
		Object.keys(source).forEach(function (key) {
			if (!target.hasOwnProperty(key)) {
				if (typeof source[key] === 'string') {
					pushedKeys.push(key);
					target[key] = source[key];
				} else {
					target[key] = {};
					var result = sync(source[key], target[key]);
					pushedKeys.push.apply(pushedKeys, result.pushed);
					removedKeys.push.apply(removedKeys, result.removed);
				}
			} else {
				if (typeof source[key] !== typeof target[key]) {
					var mismatchError = makeTypeMismatchError(fileName, key, source[key], target[key]);
					throw mismatchError;
				}
			}
		});
		
		Object.keys(target).forEach(function (key) {
			if (!source.hasOwnProperty(key)) {
				delete target[key];
				removedKeys.push(key);
			}
		});
		
		return {
			pushed: pushedKeys,
			removed: removedKeys
		};
	}
	
	function makeTypeMismatchError(fileName, keyName, sourceValue, targetValue) {
		return new PluginError(pluginName, [
			'Type mismatch on key ',
			gutil.colors.cyan(keyName),
			' in file ',
			gutil.colors.cyan(fileName),
			'. Source type ',
			gutil.colors.cyan(typeof sourceValue),
			', target type ',
			gutil.colors.cyan(typeof targetValue)
		].join(''));
	}

	function bufferToObject(buffer) {
		var contents = buffer.toString();
		return contents ? JSON.parse(contents) : {};
	}

	function objectToBuffer(object) {
		var contents = JSON.stringify(object, null, 4);
		return new Buffer(contents);
	}
	
	function stringifyKeyList(array) {
		return array.map(function(key) {
			return gutil.colors.cyan(key);
		}).join(", ");
	}
	
	function getResultString(keysArray) {
		if (keysArray.length <= 3) {
			return stringifyKeyList(keysArray);
		}
		return [
			stringifyKeyList(keysArray.slice(0, 3)),
			' and ',
			gutil.colors.magenta(keysArray.length - 3),
			' more'
		].join('');
	}

	return through.obj(addFiles, processFiles);
}

gulp.task('default', function () {
	return gulp.src('./test/*.json')
		.pipe(syncDirectory('en.json'))
		.pipe(gulp.dest('./test/'));
});