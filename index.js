/* global Buffer */
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var merge = require('merge');
var PluginError = gutil.PluginError;
var log = gutil.log;
var colors = gutil.colors;
'use strict';

var pluginName = 'gulp-sync-json';
var modes = {
	write: 'write',
	report: 'report'
};

module.exports = function(primaryFile, options) {
	if (!primaryFile) {
		throw new PluginError(pluginName, 'Primary file is required');
	}
	
	var directories = {}; // { [path: string]: { source: Vinyl, targets: Vinyl[] }
	options = merge({
		report: false,
		spaces: 4
	}, options);
	var mode = options.report ? modes.report : modes.write;
	var reportFailure = false;

	function addFiles(file, enc, done) {
		if (file.isStream()) {
			this.emit('error', new PluginError(pluginName, 'Streams not supported'));
			return done();
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
		if (mode === modes.report && reportFailure) {
			stream.emit('error', new PluginError(pluginName, 'Report failed: One or more JSON key structures not aligned'));
		}
		done();
	}

	function processDirectory(source, targets, stream) {
		var sourceKeys = bufferToObject(source.contents);
		stream.push(source);
		targets.forEach(function (target) {
			var fileName = target.path.replace(target.cwd, '');
			var targetKeys = bufferToObject(target.contents);
			var syncResult = sync(sourceKeys, targetKeys, stream, fileName);
			logSyncResult(syncResult, fileName, mode);
			if (mode === modes.write) {
				target.contents = objectToBuffer(targetKeys, options.spaces);			
			} else if (syncResult.pushed.length || syncResult.removed.length) {
				reportFailure = true;
			}
			stream.push(target);
		});
	}
	
	function sync(source, target, stream, fileName) {
		var pushedKeys = [];
		var removedKeys = [];
	
		Object.keys(source).forEach(function (key) {
			function recurse(key) {
				var result = sync(source[key], target[key], stream, fileName);
				pushedKeys.push.apply(pushedKeys, result.pushed);
				removedKeys.push.apply(removedKeys, result.removed);
			}
			
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
						recurse(key);
						break;
					default:
						break;
				}
			} else {
				if (typeof source[key] !== typeof target[key]) {
					var mismatchError = makeTypeMismatchError(fileName, key, source[key], target[key]);
					if (mode === modes.write) {
						stream.emit('error', mismatchError);
					} else {
						log(colors.red(mismatchError.message));
						reportFailure = true;
					}
				} else {
					var o = source[key];
					if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
						recurse(key);
					}
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

	return through.obj(addFiles, processFiles);
};


function bufferToObject(buffer) {
	var contents = buffer.toString();
	return contents ? JSON.parse(contents) : {};
}

function objectToBuffer(object, spaces) {
	var contents = JSON.stringify(object, null, spaces);
	return new Buffer(contents);
}

function makeTypeMismatchError(fileName, keyName, sourceValue, targetValue) {
	return new PluginError(pluginName, [
		'Type mismatch on key ',
		colors.cyan(keyName),
		' in file ',
		colors.cyan(fileName),
		'. Source type ',
		colors.cyan(typeof sourceValue),
		', target type ',
		colors.cyan(typeof targetValue)
	].join(''));
}

function logSyncResult(syncResult, fileName, mode) {
	var prefix;
	if (syncResult.pushed.length) {
		prefix = mode === modes.write ? 'Pushed to' : 'Missing keys in';
		log(prefix, colors.cyan(fileName) + ':', getResultString(syncResult.pushed));
	}
	if (syncResult.removed.length) {
		prefix = mode === modes.write ? 'Removed from' : 'Orphaned keys found in';
		log(prefix, colors.cyan(fileName) + ':', getResultString(syncResult.removed));
	}
}

function getResultString(keysArray) {
	if (keysArray.length <= 3) {
		return stringifyKeyList(keysArray);
	}
	return [
		stringifyKeyList(keysArray.slice(0, 3)),
		' and ',
		colors.magenta(keysArray.length - 3),
		' more'
	].join('');
}

function stringifyKeyList(array) {
	return array.map(function(key) {
		return colors.cyan(key);
	}).join(', ');
}
