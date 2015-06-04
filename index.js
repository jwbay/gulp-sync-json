/* global Buffer */
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var merge = require('merge');
var os = require('os');
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
	var reportErrors = [];

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
			if (dir.source && dir.targets && dir.targets.length > 0) {
				processDirectory(dir.source, dir.targets, stream);	
			} else {
				if (dir.source) {
					stream.push(dir.source);
				}
				if (dir.targets) {
					dir.targets.forEach(function(file) {
						stream.push(file);
					});
				}
			}
		});
		if (mode === modes.report && reportErrors.length) {
			var allMessages = reportErrors.map(function(e) {
				return e.message;
			}).join(os.EOL);
			stream.emit('error', new PluginError(pluginName, 'Report failed: ' + os.EOL + allMessages));
		}
		done();
	}

	function processDirectory(source, targets, stream) {
		var sourceKeys = fileToObject(source, stream);
		if (sourceKeys === null) { return; }
		stream.push(source);
		targets.forEach(function (target) {
			var name = getName(target);
			var targetKeys = fileToObject(target, stream);
			if (targetKeys === null) { return; }
			var syncResult = sync(sourceKeys, targetKeys, stream, name);
			logSyncResult(syncResult, name, mode);
			if (mode === modes.write) {
				target.contents = objectToBuffer(targetKeys, options.spaces);
			} else if (syncResult.pushed.length || syncResult.removed.length) {
				reportErrors.push(new PluginError(pluginName, name + ': key structure not aligned with primary'));
			}
			stream.push(target);
		});
	}
	
	function sync(source, target, stream, name) {
		var pushedKeys = [];
		var removedKeys = [];
	
		Object.keys(source).forEach(function (key) {
			function recurse(key) {
				var result = sync(source[key], target[key], stream, name);
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
					var typeMismatchError = makeTypeMismatchError(name, key, source[key], target[key]);
					handleError(typeMismatchError, stream);
				} else {
					if (getTypeName(source[key]) === 'Object') {
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

	function fileToObject(file, stream) {
		var name = getName(file);
		var parsedContents;
		
		try {
			var contents = file.contents.toString().trim();
			if (!contents) {
				parsedContents = {};
			} else {
				parsedContents = JSON.parse(contents);
			}
		} catch (error) {
			var jsonError = new PluginError(pluginName, name + ' contains invalid JSON');
			handleError(jsonError, stream);
			return null;
		}

		var typeName = getTypeName(parsedContents);
		if (typeName !== 'Object') {
			var notObjectError = new PluginError(pluginName, name + ' is a JSON type that cannot be synced: ' + typeName + '. Only Objects are supported');
			handleError(notObjectError, stream);
			return null;
		}

		return parsedContents;
	}
	
	function handleError(error, stream) {
		if (mode === modes.write) {
			stream.emit('error', error);
		} else {
			reportErrors.push(error);
		}
	}

	return through.obj(addFiles, processFiles);
};

function getTypeName(o) {
	var fullName = Object.prototype.toString.call(o);
	return fullName.split(' ')[1].slice(0, -1); //[object Number] -> Number
}

function getName(file) {
	return file.path.replace(file.cwd, '');
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
