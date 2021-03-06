'use strict';
var gutil = require('gulp-util');
var utils = require('./utils');
var syncObjects = require('./sync-objects');
var logResult = require('./log-file-result');
var colors = gutil.colors;

exports.sync = function(sourceFile, targetFiles, options) {
	this.push(sourceFile);
	var fileName = utils.getFileName(sourceFile);
	var sourceObject = utils.fileToObject.call(this, sourceFile);
	if (sourceObject === void 0 || !checkFileRootTypeCanBeSynced.call(this, sourceObject, fileName)) {
		targetFiles.forEach(this.push.bind(this));
		return;
	}
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

function syncSingleFile(options, sourceObject, targetFile) {
	var fileName = utils.getFileName(targetFile);
	var targetObject = utils.fileToObject.call(this, targetFile);
	if (targetObject === void 0 || !checkFileRootTypeCanBeSynced.call(this, targetObject, fileName)) {
		this.push(targetFile);
		return;
	}

	var pushedKeys = [];
	var removedKeys = [];
	var onKeyPush = Array.prototype.push.bind(pushedKeys);
	var onKeyRemove = Array.prototype.push.bind(removedKeys);
	//this just bubbles up a syncError, but having it here means object sync code doesn't have
	//to pass around a filename all over the place
	var onKeyTypeMismatch = function (errorMessageSuffix) {
		this.emit('syncError', colors.cyan(fileName) + errorMessageSuffix);
	};

	this.on('keyPushed', onKeyPush)
		.on('keyRemoved', onKeyRemove)
		.on('keyTypeMismatch', onKeyTypeMismatch);

	syncObjects.call(this, sourceObject, targetObject);

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