/* global Buffer */
var gulp = require('gulp');
var gutil = require('gulp-util');
var through = require('through2');
var PluginError = gutil.PluginError;

'use strict';

function syncDirectory(primaryFile) {
	var source;
	var targets = [];
	
	function addFiles(file, enc, done) {
		if (file.relative === primaryFile) {
			source = file;
		} else {
			targets.push(file);
		}
		done();
	}
	
	function processFiles(done) {
		var sourceKeys = bufferToObject(source.contents);
		var _this = this;
		targets.forEach(function (target) {
			var targetKeys = bufferToObject(target.contents);
			sync(sourceKeys, targetKeys);
			target.contents = objectToBuffer(targetKeys);
			_this.push(target);
		});
		done();
	}
	
	function sync(source, target) {
		Object.keys(source).forEach(function (key) {
			if (!target.hasOwnProperty(key)) {
				if (typeof source[key] === 'string') {
					target[key] = source[key];
				} else {
					target[key] = {};
					sync(source[key], target[key]);
				}
			} else {
				if (typeof source[key] !== typeof target[key]) {
					throw new PluginError('Type mismatch on key ' + key);
				}
			}
		});
		Object.keys(target).forEach(function (key) {
			if (!source.hasOwnProperty(key)) {
				delete target[key];
			}
		});
	}		
	
	function bufferToObject(buffer) {
		var contents = buffer.toString();
		return contents ? JSON.parse(contents) : {};
	}

	function objectToBuffer(object) {
		var contents = JSON.stringify(object, null, 4);
		return new Buffer(contents);
	}
	
	return through.obj(addFiles, processFiles);
}

gulp.task('default', function () {
	return gulp.src('./test/*.json')
		.pipe(syncDirectory('en.json'))
		.pipe(gulp.dest('./test/'));
});