'use strict';
/* global Buffer */
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var merge = require('merge');
var os = require('os');
var PluginError = gutil.PluginError;
var colors = gutil.colors;

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
		spaces: 4,
		verbose: false
	}, options);
	var mode = options.report ? modes.report : modes.write;
	var reportErrors = []; //TODO these are never emitted, can just be string[]

	function intakeFile(file, enc, done) {
		if (file.isStream()) {
			this.emit('error', new PluginError(pluginName, 'Streams not supported'));
			return done();
		}

		assignFileToDirectory(file);
		done();
	}

	function processFiles(done) {
		Object.keys(directories).forEach(processDirectory.bind(this));

		if (mode === modes.report && reportErrors.length > 0) {
			emitReport.call(this);
		}

		done();
	}

	function assignFileToDirectory(file) {
		var directory = path.dirname(file.path);
		var dir = directories[directory] = directories[directory] || {};
		if (path.basename(file.path) === primaryFile) {
			dir.source = file;
		} else {
			dir.targets = dir.targets || [];
			dir.targets.push(file);
		}
	}

	function emitReport() {
		var allMessages = reportErrors.map(function (e) {
			return e.message;
		}).join(os.EOL);

		gutil.log(colors.cyan(pluginName), " report found the following:" + os.EOL + allMessages);

		var errorMessage = 'Report failed with ' + reportErrors.length + ' items';
		this.emit('error', new PluginError(pluginName, errorMessage));
	}

	function processDirectory(directory) {
		var dir = directories[directory];
		if (dir.source && dir.targets && dir.targets.length > 0) {
			syncFiles.call(this, dir.source, dir.targets);
		} else {
			ignoreFiles.call(this, dir.source, dir.targets);
		}
	}

	function ignoreFiles(source, targets) {
		if (source) {
			this.push(source);
		}
		if (targets) {
			targets.forEach(this.push.bind(this));
		}
	}

	//TODO early return causes all target files to get dropped from stream in report mode
	function syncFiles(sourceFile, targetFiles) {
		this.push(sourceFile);
		var sourceObject = fileToObject.call(this, sourceFile);
		if (sourceObject === null) { return; }

		targetFiles.forEach(syncSingleFile.bind(this, sourceObject));
	}

	//TODO early return causes some files to get dropped from stream in report mode
	function syncSingleFile(sourceObject, targetFile) {
		var fileName = getName(targetFile);
		var targetObject = fileToObject.call(this, targetFile);
		if (targetObject === null) { return; }

		var pushedKeys = [];
		var removedKeys = [];
		var recordPush = Array.prototype.push.bind(pushedKeys);
		var recordRemove = Array.prototype.push.bind(removedKeys);
		this.on('keyPushed', recordPush).on('keyRemoved', recordRemove);
		syncObjects.call(this, sourceObject, targetObject, fileName);
		this.removeListener('keyPushed', recordPush).removeListener('keyRemoved', recordRemove);

		if (options.verbose) {
			logSyncResult(pushedKeys, removedKeys, fileName, mode);
		}

		if (mode === modes.write) {
			targetFile.contents = objectToBuffer(targetObject, options.spaces);
		} else if (pushedKeys.length || removedKeys.length) {
			reportErrors.push(new PluginError(pluginName, colors.cyan(fileName) + ' contains unaligned key structure'));
		}

		this.push(targetFile);
	}

	function syncObjects(source, target, fileName) {
		Object.keys(source).forEach(mergeKey.bind(this, source, target, fileName));
		Object.keys(target).forEach(clearKey.bind(this, source, target));
	}

	//TODO does not log deeply removed keys, need to walk tree and gather key names that have primitive/array values
	function clearKey(source, target, key) {
		if (!source.hasOwnProperty(key)) {
			delete target[key];
			this.emit('keyRemoved', key);
		}
	}

	function mergeKey(source, target, fileName, key) {
		var sourceValue = source[key];
		var sourceType = getTypeName(sourceValue);
		var targetValue = target[key];
		var targetType = getTypeName(targetValue);

		if (target.hasOwnProperty(key)) {
			if (sourceType === targetType) {
				if (sourceType === 'Object') {
					syncObjects.call(this, sourceValue, targetValue, fileName);
				}
			} else {
				var typeMismatchError = makeTypeMismatchError(fileName, key, sourceValue, targetValue);
				handleError(typeMismatchError, this);
			}
		} else {
			copyValue.call(this, sourceValue, target, fileName, key);
		}
	};

	function copyValue(sourceValue, target, fileName, key) {
		if (getTypeName(sourceValue) === 'Object') {
			target[key] = {};
			syncObjects.call(this, sourceValue, target[key], fileName);
		} else {
			target[key] = sourceValue;
			this.emit('keyPushed', key);
		}
	}

	function fileToObject(file) {
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
			this.emit('error', error);
			return;
		}

		var typeName = getTypeName(parsedContents);
		if (typeName !== 'Object') {
			var notObjectError = new PluginError(pluginName, colors.cyan(name) + ' is a JSON type that cannot be synced: ' + colors.cyan(typeName) + '. Only Objects are supported');
			handleError(notObjectError, this);
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

	return through.obj(intakeFile, processFiles);
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
		colors.cyan(fileName),
		' contains type mismatch on key ',
		colors.cyan(keyName),
		'. Source type ',
		colors.cyan(typeof sourceValue),
		', target type ',
		colors.cyan(typeof targetValue)
	].join(''));
}

function logSyncResult(pushed, removed, fileName, mode) {
	var prefix;
	if (pushed.length) {
		prefix = mode === modes.write ? 'Pushed to' : 'Missing keys in';
		gutil.log(prefix, colors.cyan(fileName) + ':', getResultString(pushed));
	}
	if (removed.length) {
		prefix = mode === modes.write ? 'Removed from' : 'Orphaned keys found in';
		gutil.log(prefix, colors.cyan(fileName) + ':', getResultString(removed));
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
