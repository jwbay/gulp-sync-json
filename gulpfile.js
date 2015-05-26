/* global Buffer */
var gulp = require('gulp');

var syncJSON = require('./');

gulp.task('default', function () {
	return gulp.src('./**/*.json')
		.pipe(syncJSON('en.json', { verify: false }))
		.pipe(gulp.dest('./'));
});