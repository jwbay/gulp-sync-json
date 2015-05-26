/* global Buffer */
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var PluginError = gutil.PluginError;
var log = gutil.log;
'use strict';

var pluginName = 'gulp-sync-json';
var modes = {
	write: 'write',
	report: 'report'
};

module.exports = function(primaryFile, options) {
	var directories = {}; // { [path: string]: { source: Vinyl, targets: Vinyl[] }
	var mode = (options || {}).report ? modes.report : modes.write;
	var verificationFailed = false;

	function addFiles(file, enc, done) {
		if (file.isStream()) {
			throw new PluginError(pluginName, 'Streams not supported');
		}

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
		if (mode === modes.report && verificationFailed) {
			var verificationFailedError = new PluginError(pluginName, 'Verification failed: One or more JSON key structures not aligned');
			throw verificationFailedError;
		}
		done();
	}

	function processDirectory(source, targets, stream) {
		var sourceKeys = bufferToObject(source.contents);
		stream.push(source);
		targets.forEach(function (target) {
			var fileName = target.path.replace(target.cwd, '');
			var targetKeys = bufferToObject(target.contents);
			var syncResult = sync(sourceKeys, targetKeys, fileName);
			logSyncResult(syncResult, fileName, mode);
			if (mode === modes.write) {
				target.contents = objectToBuffer(targetKeys);			
			} else if (syncResult.pushed.length || syncResult.removed.length) {
				verificationFailed = true;
			}
			stream.push(target);
		});
	}

	return through.obj(addFiles, processFiles);
};

function sync(source, target, fileName) {
	var pushedKeys = [];
	var removedKeys = [];

	Object.keys(source).forEach(function (key) {
		if (!target.hasOwnProperty(key)) {
			switch (typeof source[key]) {
				case 'string':
				case 'boolean':
				case 'number':
					pushedKeys.push(key);
					target[key] = source[key];
					break;
				case 'object':
					if (source[key] === null || Array.isArray(source[key])) {
						pushedKeys.push(key);
						target[key] = source[key];
						break;
					}
					target[key] = {};
					var result = sync(source[key], target[key], fileName);
					pushedKeys.push.apply(pushedKeys, result.pushed);
					removedKeys.push.apply(removedKeys, result.removed);
					break;
				default:
					break;
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

function logSyncResult(syncResult, fileName, mode) {
	var prefix;
	if (syncResult.pushed.length) {
		prefix = mode === modes.write ? 'Pushed to' : 'Missing keys in';
		log(prefix, gutil.colors.cyan(fileName) + ':', getResultString(syncResult.pushed));
	}
	if (syncResult.removed.length) {
		prefix = mode === modes.write ? 'Removed from' : 'Orphaned keys found in';
		log(prefix, gutil.colors.cyan(fileName) + ':', getResultString(syncResult.removed));
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
