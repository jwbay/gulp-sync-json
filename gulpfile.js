var gulp = require('gulp');
var through = require('through2');

function syncDirectory(primaryFile) {
	var primary;
	var others = [];
	
	function fileToJSON(file) {
		var contents = file.contents.toString();
		if (contents) {
			return JSON.parse(contents);
		} 
		return {};
	}
	
	function processFile(file, enc, cb) {
		if (file.relative === primaryFile) {	
			primary = fileToJSON(file); 
		} else {
			others.push(fileToJSON(file));
		}
		cb();
	}
	
	function endStream(cb) {
		console.log('primary: ', JSON.stringify(primary));
		console.log('others: ', JSON.stringify(others));
		cb();
	}
	
	var stream = through.obj(processFile, endStream);
	
	return stream;
}

gulp.task('default', function () {
	return gulp.src('./test/*.json')
		.pipe(syncDirectory('en.json'))
		.pipe(gulp.dest('./test/'));
});