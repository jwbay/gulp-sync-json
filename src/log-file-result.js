'use strict';
var gutil = require('gulp-util');
var colors = gutil.colors;

module.exports = function(pushed, removed, fileName, reportMode) {
	var prefix;
	if (pushed.length) {
		prefix = reportMode ? 'Missing keys in' : 'Pushed to';
		gutil.log(prefix, colors.cyan(fileName) + ':', getResultString(pushed));
	}
	if (removed.length) {
		prefix = reportMode ? 'Orphaned keys found in' : 'Removed from';
		gutil.log(prefix, colors.cyan(fileName) + ':', getResultString(removed));
	}
};

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