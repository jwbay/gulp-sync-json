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
	
	options = merge({
		report: false,
		spaces: 4,
		verbose: false
	}, options);

	var directories = {}; // { [path: string]: { source: Vinyl, targets: Vinyl[] }
	var mode = options.report ? modes.report : modes.write;
	var reportErrors = [];
	var onReportError = Array.prototype.push.bind(reportErrors);

	function intakeFile(file, enc, done) {
		if (file.isStream()) {
			this.emit('error', new PluginError(pluginName, 'Streams not supported'));
			return done();
		}

		assignFileToDirectory(file);
		done();
	}

	function processFiles(done) {
		var handleSyncError = onSyncError.bind(this, mode);

		this.on('syncError', handleSyncError)
			.on('reportError', onReportError);

		Object.keys(directories).forEach(processDirectory.bind(this));

		this.removeListener('syncError', onSyncError)
			.removeListener('reportError', onReportError);

		if (mode === modes.report && reportErrors.length > 0) {
			emitReport.call(this, reportErrors);
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
		if (!checkTypeCanBeSynced.call(this, sourceObject, getFileName(sourceFile))) { return; }

		targetFiles.forEach(syncSingleFile.bind(this, sourceObject));
	}

	//TODO early return causes some files to get dropped from stream in report mode
	function syncSingleFile(sourceObject, targetFile) {
		var fileName = getFileName(targetFile);
		var targetObject = fileToObject.call(this, targetFile);
		if (!checkTypeCanBeSynced.call(this, targetObject, fileName)) { return; }

		var pushedKeys = [];
		var removedKeys = [];
		var onKeyPush = Array.prototype.push.bind(pushedKeys);
		var onKeyRemove = Array.prototype.push.bind(removedKeys);
		var onKeyTypeMismatch = function (errorMessageSuffix) {
			this.emit('syncError', colors.cyan(fileName) + errorMessageSuffix);
		};

		this.on('keyPushed', onKeyPush)
			.on('keyRemoved', onKeyRemove)
			.on('keyTypeMismatch', onKeyTypeMismatch);

		syncObjects.call(this, sourceObject, targetObject, fileName);

		this.removeListener('keyPushed', onKeyPush)
			.removeListener('keyRemoved', onKeyRemove)
			.removeListener('keyTypeMismatch', onKeyTypeMismatch);


		if (options.verbose) {
			logSyncResult(pushedKeys, removedKeys, fileName, mode);
		}

		if (mode === modes.write) {
			targetFile.contents = objectToBuffer(targetObject, options.spaces);
		} else if (pushedKeys.length || removedKeys.length) {
			reportErrors.push(colors.cyan(fileName) + ' contains unaligned key structure');
		}

		this.push(targetFile);
	}

	return through.obj(intakeFile, processFiles);
};

function onSyncError(mode, errorMessage) {
	if (mode === modes.write) {
		this.emit('error', new PluginError(pluginName, errorMessage));
	} else {
		this.emit('reportError', errorMessage);
	}
}

function emitReport(failureMessages) {
	var allMessages = failureMessages.join(os.EOL);
	gutil.log(colors.cyan(pluginName), " report found the following:" + os.EOL + allMessages);
	var errorMessage = 'Report failed with ' + failureMessages.length + ' items';
	//TODO param for this
	this.emit('error', new PluginError(pluginName, errorMessage));
}

function syncObjects(source, target) {
	Object.keys(source).forEach(mergeKey.bind(this, source, target));
	Object.keys(target).forEach(clearKey.bind(this, source, target));
}

//TODO does not log deeply removed keys, need to walk tree and gather key names that have primitive/array values
function clearKey(source, target, key) {
	if (!source.hasOwnProperty(key)) {
		delete target[key];
		this.emit('keyRemoved', key);
	}
}

function mergeKey(source, target, key) {
	var sourceValue = source[key];
	var sourceType = getTypeName(sourceValue);
	var targetValue = target[key];
	var targetType = getTypeName(targetValue);

	if (target.hasOwnProperty(key)) {
		if (sourceType === targetType) {
			if (sourceType === 'Object') {
				syncObjects.call(this, sourceValue, targetValue);
			}
		} else {
			var errorMessage = makeTypeMismatchErrorSuffix(key, sourceValue, targetValue);
			this.emit('keyTypeMismatch', errorMessage);
		}
	} else {
		copyValue.call(this, sourceValue, target, key);
	}
};

function copyValue(sourceValue, target, key) {
	if (getTypeName(sourceValue) === 'Object') {
		target[key] = {};
		syncObjects.call(this, sourceValue, target[key]);
	} else {
		target[key] = sourceValue;
		this.emit('keyPushed', key);
	}
}

function checkTypeCanBeSynced(obj, fileName) {
	var typeName = getTypeName(obj);
	if (typeName !== 'Object') {
		var errorMessage = colors.cyan(fileName) + ' is a JSON type that cannot be synced: ' + colors.cyan(typeName) + '. Only Objects are supported';
		this.emit('syncError', errorMessage)
		return false;
	}
	return true;
}

function fileToObject(file) {
	var fileName = getFileName(file);
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

	return parsedContents;
}

function getTypeName(o) {
	var fullName = Object.prototype.toString.call(o);
	return fullName.split(' ')[1].slice(0, -1); //[object Number] -> Number
}

function getFileName(file) {
	return file.path.replace(file.cwd, '');
}

function objectToBuffer(object, spaces) {
	var contents = JSON.stringify(object, null, spaces);
	return new Buffer(contents);
}

function makeTypeMismatchErrorSuffix(keyName, sourceValue, targetValue) {
	return [' contains type mismatch on key ',
		colors.cyan(keyName),
		'. Source type ',
		colors.cyan(typeof sourceValue),
		', target type ',
		colors.cyan(typeof targetValue)
	].join('');
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
