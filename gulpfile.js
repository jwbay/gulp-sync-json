var gulp = require('gulp');
var through = require('through2');

function syncDirectory() {
	var stream = through.obj(function(file, enc, cb) {
		var contents = file.contents.toString();
		if (contents) {
			var keys = JSON.parse(contents);
			console.log(JSON.stringify(keys, true, 2));
		}
		this.push(file);
		cb();
	});
	
	return stream;
}

gulp.task('default', function () {
	gulp.src('./test/*.json')
		.pipe(syncDirectory())
		.pipe(gulp.dest('./test/'));
});