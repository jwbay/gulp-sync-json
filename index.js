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

	function processFiles(done) {
		var handleSyncError = onSyncError.bind(this, options.report);

		this.on('syncError', handleSyncError)
			.on('reportError', onReportError);

		Object.keys(directories).forEach(processDirectory.bind(this));

		this.removeListener('syncError', handleSyncError)
			.removeListener('reportError', onReportError);

		if (options.report && reportErrors.length > 0) {
			emitReport.call(this, reportErrors);
		}

		done();
	}

	function processDirectory(directory) {
		var dir = directories[directory];
		if (dir.source && dir.targets && dir.targets.length > 0) {
			syncFiles.call(this, dir.source, dir.targets, options);
		} else {
			ignoreFiles.call(this, dir.source, dir.targets);
		}
	}

	return through.obj(intakeFile, processFiles);
};

//TODO early return causes all target files to get dropped from stream in report mode
function syncFiles(sourceFile, targetFiles, options) {
	this.push(sourceFile);
	var sourceObject = fileToObject.call(this, sourceFile);
	if (!checkTypeCanBeSynced.call(this, sourceObject, getFileName(sourceFile))) { return; }

	targetFiles.forEach(syncSingleFile.bind(this, options, sourceObject));
}

//TODO early return causes some files to get dropped from stream in report mode
function syncSingleFile(options, sourceObject, targetFile) {
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
		logSyncResult(pushedKeys, removedKeys, fileName, options.report);
	}

	if (options.report && (pushedKeys.length || removedKeys.length)) {
		this.emit('reportError', colors.cyan(fileName) + ' contains unaligned key structure');
	} else {
		targetFile.contents = objectToBuffer(targetObject, options.spaces);
	}

	this.push(targetFile);
}

function ignoreFiles(source, targets) {
	if (source) {
		this.push(source);
	}
	if (targets) {
		targets.forEach(this.push.bind(this));
	}
}

function onSyncError(reportMode, errorMessage) {
	if (reportMode) {
		this.emit('reportError', errorMessage);
	} else {
		this.emit('error', new PluginError(pluginName, errorMessage));
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

function logSyncResult(pushed, removed, fileName, reportMode) {
	var prefix;
	if (pushed.length) {
		prefix = reportMode ? 'Missing keys in' : 'Pushed to';
		gutil.log(prefix, colors.cyan(fileName) + ':', getResultString(pushed));
	}
	if (removed.length) {
		prefix = reportMode ? 'Orphaned keys found in' : 'Removed from';
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
