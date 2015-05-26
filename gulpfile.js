var gulp = require('gulp');
var syncJSON = require('./');

gulp.task('default', function () {
	return gulp.src('./**/*.json')
		.pipe(syncJSON('en.json'))
		.pipe(gulp.dest('./'));
});