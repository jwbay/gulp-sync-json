'use strict';
var gutil = require('gulp-util');
var utils = require('./utils');
var syncObjects = require('./sync-objects');
var logResult = require('./log-file-result');
var colors = gutil.colors;

//TODO early return causes all target files to get dropped from stream in report mode
exports.sync = function(sourceFile, targetFiles, options) {
	this.push(sourceFile);
	var sourceObject = utils.fileToObject.call(this, sourceFile);
	if (!checkFileRootTypeCanBeSynced.call(this, sourceObject, utils.getFileName(sourceFile))) { return; }

	targetFiles.forEach(syncSingleFile.bind(this, options, sourceObject));
};

exports.ignore = function(sourceFile, targetFiles) {
	if (sourceFile) {
		this.push(sourceFile);
	}
	if (targetFiles) {
		targetFiles.forEach(this.push.bind(this));
	}
};

//TODO early return causes some files to get dropped from stream in report mode
function syncSingleFile(options, sourceObject, targetFile) {
	var fileName = utils.getFileName(targetFile);
	var targetObject = utils.fileToObject.call(this, targetFile);
	if (!checkFileRootTypeCanBeSynced.call(this, targetObject, fileName)) { return; }

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
		logResult(pushedKeys, removedKeys, fileName, options.report);
	}

	if (options.report && (pushedKeys.length || removedKeys.length)) {
		this.emit('reportError', colors.cyan(fileName) + ' contains unaligned key structure');
	} else {
		targetFile.contents = utils.objectToBuffer(targetObject, options.spaces);
	}

	this.push(targetFile);
}

function checkFileRootTypeCanBeSynced(obj, fileName) {
	var typeName = utils.getTypeName(obj);
	if (typeName !== 'Object') {
		var errorMessage = [
			colors.cyan(fileName),
			' is a JSON type that cannot be synced: ',
			colors.cyan(typeName),
			'. Only Objects are supported'
		].join('');
		this.emit('syncError', errorMessage);
		return false;
	}
	return true;
}