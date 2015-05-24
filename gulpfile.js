var gulp = require('gulp');
var through = require('through2');

function syncDirectory() {
	var stream = through.obj(function(file, enc, cb) {
		console.log(file.path);		
		this.push(file);
	});
	
	return stream;
}

gulp.task("default", function () {
	gulp.src("./test/*.json")
		.pipe(syncDirectory())
		.pipe(gulp.dest("./test/"));
});