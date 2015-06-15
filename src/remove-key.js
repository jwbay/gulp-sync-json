var utils = require('./utils');

module.exports = function(source, target, key) {
	if (!source.hasOwnProperty(key)) {
		var logRemoval = this.emit.bind(this, 'keyRemoved');
		if (utils.getTypeName(target[key]) === 'Object') {
			gatherKeysFor(target[key]).forEach(logRemoval);
		} else {
			logRemoval(key);
		}
		//base case: key in target not found in source; remove it
		delete target[key];	
	}
};

function gatherKeysFor(object) {
	return Object.keys(object)
		.map(gatherPrimitivesForSingleKey.bind(this, object))
		.reduce(flatten, []);
}

function gatherPrimitivesForSingleKey(object, key) {
	if (utils.getTypeName(object[key]) === 'Object') {
		return gatherKeysFor(object[key]);
	} else {
		return [key];
	}
}

function flatten(flattened, arrayOfArrays) {
	return arrayOfArrays.map(function(array) {
		return flattened.concat(array);
	});
}