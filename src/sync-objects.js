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
			//base case 1: source and target agree on key name and value type,
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
		//base case 2: source contains key not present in target; copy it
		target[key] = sourceValue;
		this.emit('keyPushed', key);
	}
}

function clearKey(source, target, key) {
	var logRemoval = this.emit.bind(this, 'keyRemoved');
	if (!source.hasOwnProperty(key)) {
		if (utils.getTypeName(target[key]) === 'Object') {
			gatherPrimitiveKeyNames(target[key]).forEach(logRemoval);
		} else {
			logRemoval(key);
		}
		//base case 3: target contains key not present in source; clear it
		delete target[key];	
	}
}

function gatherPrimitiveKeyNames(object) {
	return Object.keys(object)
		.map(gatherSingleKeyPrimitives.bind(this, object))
		.reduce(flatten, []);
}

function gatherSingleKeyPrimitives(object, key) {
	if (utils.getTypeName(object[key]) === 'Object') {
		return gatherPrimitiveKeyNames(object[key]);
	} else {
		return [key];
	}
}

function flatten(flattened, arrayOfArrays) {
	return arrayOfArrays.map(function(array) {
		return flattened.concat(array);
	});
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