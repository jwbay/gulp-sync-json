'use strict';
var utils = require('./utils');
var colors = require('gulp-util').colors;

var syncObjects = module.exports = function(source, target) {
	Object.keys(source).forEach(mergeKey.bind(this, source, target));
	Object.keys(target).forEach(clearKey.bind(this, source, target));
};

function mergeKey(source, target, key) {
	var sourceValue = source[key];
	var sourceType = utils.getTypeName(sourceValue);
	var targetValue = target[key];
	var targetType = utils.getTypeName(targetValue);

	if (target.hasOwnProperty(key)) {
		if (sourceType === targetType) {
			if (sourceType === 'Object') {
				syncObjects.call(this, sourceValue, targetValue);
			}
			//base case 2: source and target agree on key name and value type,
			//so keep target value intact by doing nothing
		} else {
			var errorMessage = makeTypeMismatchErrorSuffix(key, sourceType, targetType);
			this.emit('keyTypeMismatch', errorMessage);
		}
	} else {
		copyValue.call(this, sourceValue, target, key);
	}
};

function copyValue(sourceValue, target, key) {
	if (utils.getTypeName(sourceValue) === 'Object') {
		target[key] = {};
		//could just set target[key] instead of calling sync but we'd lose logging
		syncObjects.call(this, sourceValue, target[key]);
	} else {
		//base case 3: source contains key not present in target; copy it
		target[key] = sourceValue;
		this.emit('keyPushed', key);
	}
}

function clearKey(source, target, key) {
	if (!source.hasOwnProperty(key)) {
		if (utils.getTypeName(target[key]) === 'Object') {
			gatherPrimitiveKeyNames(target[key]).forEach(function(key) {
				this.emit('keyRemoved', key);
			}, this);
		} else {
			this.emit('keyRemoved', key);
		}
		//base case 1: target contains key not present in source; clear it
		delete target[key];	
	}
}

function gatherPrimitiveKeyNames(object) {
	return Object.keys(object).map(function(key) {
		if (utils.getTypeName(object[key]) === 'Object') {
			return gatherPrimitiveKeyNames(object[key]);
		} else {
			return [key];
		}
	}).reduce(function(prev, current) {
		for (var i = 0; i < current.length; i++) {
			prev = prev.concat(current[i]);
		}
		return prev;
	}, []);
}

function makeTypeMismatchErrorSuffix(keyName, sourceType, targetType) {
	return [
		' contains type mismatch on key ',
		colors.cyan(keyName),
		'. Source type ',
		colors.cyan(sourceType),
		', target type ',
		colors.cyan(targetType)
	].join('');
}