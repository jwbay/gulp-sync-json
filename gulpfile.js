/* global Buffer */
var gulp = require('gulp');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var PluginError = gutil.PluginError;
var log = gutil.log;

//TODO accept /**/*.json and group by directories containing the primary file
//TODO dry run/verification, throw errors instead of making changes
//TODO accept include/exclude filename options
//TODO guard cwd, opt-in option
//TODO clean task (re-serialize)

'use strict';

var pluginName = 'sync-l10n';

function syncJSON(primaryFile) {
	var directories = {}; // { [path: string]: { source: File, targets: File[] }

	function addFiles(file, enc, done) {
		var directory = path.dirname(file.path);
		var dir = directories[directory] = directories[directory] || {};

		if (path.basename(file.path) === primaryFile) {
			dir.source = file;
		} else {
			dir.targets = dir.targets || [];
			dir.targets.push(file);
		}
		done();
	}
	
	function processFiles(done) {
		var stream = this;
		Object.keys(directories).forEach(function(directory) {
			var dir = directories[directory];
			if (!dir.source) { return; }
			if (!dir.targets || !dir.targets.length) { return; }
			processDirectory(dir.source, dir.targets, stream);			
		});
		done();
	}

	function processDirectory(source, targets, stream) {
		var sourceKeys = bufferToObject(source.contents);

		targets.forEach(function (target) {
			var fileName = target.path.replace(target.cwd, '');
			var targetKeys = bufferToObject(target.contents);
			var syncResult = sync(sourceKeys, targetKeys, fileName);
			logSyncResult(syncResult, fileName);
			target.contents = objectToBuffer(targetKeys);
			stream.push(target);
		});
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
					var result = sync(source[key], target[key], fileName);
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

	function bufferToObject(buffer) {
		var contents = buffer.toString();
		return contents ? JSON.parse(contents) : {};
	}

	function objectToBuffer(object) {
		var contents = JSON.stringify(object, null, 4);
		return new Buffer(contents);
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

	function logSyncResult(syncResult, fileName) {
		if (syncResult.pushed.length) {
			log('Pushed to', gutil.colors.cyan(fileName) + ':', getResultString(syncResult.pushed));
		}
		if (syncResult.removed.length) {
			log('Removed from', gutil.colors.cyan(fileName) + ':', getResultString(syncResult.removed));
		}
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

	function stringifyKeyList(array) {
		return array.map(function(key) {
			return gutil.colors.cyan(key);
		}).join(', ');
	}

	return through.obj(addFiles, processFiles);
}

gulp.task('default', function () {
	return gulp.src('./**/*.json')
		.pipe(syncJSON('en.json'))
		.pipe(gulp.dest('./'));
});