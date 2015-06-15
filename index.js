'use strict';
/* global Buffer */
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var merge = require('merge');
var os = require('os');
var fileActions = require('./src/file-actions'); 

var PluginError = gutil.PluginError;
var colors = gutil.colors;
var pluginName = 'gulp-sync-json';

module.exports = function(primaryFile, options) {
	if (!primaryFile) {
		throw new PluginError(pluginName, 'Primary file is required');
	}
	
	options = merge({
		report: false,
		errorOnReportFail: false,
		spaces: 4,
		verbose: false
	}, options);

	var directories = {}; // { [path: string]: { source: Vinyl, targets: Vinyl[] }

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

	function processDirectories(done) {
		var reportErrors = [];
		var handleSyncError = onSyncError.bind(this, options.report);
		var handleReportError = Array.prototype.push.bind(reportErrors);

		//syncErrors will either be gathered for logging or promoted to actual 
		//errors on the stream depending on report mode;
		//reportErrors are always gathered and never promoted
		this.on('syncError', handleSyncError)
			.on('reportError', handleReportError);

		Object.keys(directories).forEach(processDirectory.bind(this));

		this.removeListener('syncError', handleSyncError)
			.removeListener('reportError', handleReportError);

		if (options.report && reportErrors.length > 0) {
			outputReport.call(this, reportErrors);
		}

		done();
	}

	function processDirectory(directory) {
		var dir = directories[directory];
		if (dir.source && dir.targets && dir.targets.length > 0) {
			fileActions.sync.call(this, dir.source, dir.targets, options);
		} else {
		 	fileActions.ignore.call(this, dir.source, dir.targets);
		}
	}

	function onSyncError(reportMode, errorMessage) {
		if (reportMode) {
			this.emit('reportError', errorMessage);
		} else {
			this.emit('error', new PluginError(pluginName, errorMessage));
		}
	}

	function outputReport(failureMessages) {
		var allMessages = failureMessages.join(os.EOL);
		gutil.log(colors.cyan(pluginName), ' report found the following:' + os.EOL + allMessages);
		if (options.errorOnReportFail) {
			this.emit('error', new PluginError(pluginName, 'Report failed with ' + failureMessages.length + ' items'));
		}
	}

	return through.obj(intakeFile, processDirectories);
};
