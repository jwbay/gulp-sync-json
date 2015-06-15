'use strict';
/* global Buffer */
exports.fileToObject = function(file) {
	try {
		var contents = file.contents.toString().trim();
		if (!contents) {
			return {};
		} else {
			return JSON.parse(contents);
		}
	} catch (error) {
		this.emit('error', error);
		return null;
	}
};

exports.getTypeName = function(object) {
	var fullName = Object.prototype.toString.call(object);
	return fullName.split(' ')[1].slice(0, -1); //[object Number] -> Number
};

exports.getFileName = function(file) {
	return file.path.replace(file.cwd, '');
};

exports.objectToBuffer = function(object, spaces) {
	var contents = JSON.stringify(object, null, spaces);
	return new Buffer(contents);
};