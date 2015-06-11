/* global __dirname, Buffer, describe, it*/
var gulp = require('gulp');
var gutil = require('gulp-util');
var assert = require('stream-assert');
var path = require('path');
var should = require('should');
var syncJSON = require('../');
var test = require('./test-stream');
require('mocha');

var chalk = gutil.colors;

function contentsAre(obj) {
	return function(file) {
		should.deepEqual(JSON.parse(file.contents.toString()), obj);
	};
}

describe('gulp-sync-json', function () {
	it('should throw when primary file isn\'t provided', function () {
		(function () {
			syncJSON();
		}).should.throw('Primary file is required');
	});
	
	it('should emit error on streamed file', function (done) {
		gulp.src(path.join(__dirname, 'test-stream.js'), { buffer: false })
			.pipe(syncJSON('fake.json'))
			.on('error', function (err) {
			err.message.should.eql('Streams not supported');
			done();
		});
	});
	
	it('should ignore single files', function (done) {
		var a = { a: 1 };
		test(a)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.first(contentsAre(a)))
			.pipe(assert.end(done));
	});
	
	it('should ignore files if no primary is matched', function(done) {
		var a = { a: 1 };
		var b = { b: 2 };
		var c = { c: 3 };
		test(a, b, c)
			.pipe(syncJSON('notfound.json'))
			.pipe(assert.first(contentsAre(a)))
			.pipe(assert.second(contentsAre(b)))
			.pipe(assert.nth(2, contentsAre(c)))
			.pipe(assert.end(done));
	});
	
	it('should add missing keys', function (done) {
		var primary = {
			one: 1,
			two: 2
		};
		var target = {
			one: 1
		};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre({
				one: 1,
				two: 2
			})))
			.pipe(assert.end(done));
	});
	
	it('should remove non-primary keys', function (done) {
		var primary = {
			one: 1
		};
		var target = {
			should: 'delete me'
		};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre({ one: 1 })))
			.pipe(assert.end(done));
	});
	
	it('should not change existing values', function (done) {
		var primary = {
			one: 1,
			two: 2
		};
		var target = {
			one: 3
		};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre({
				one: 3,
				two: 2
			})))
			.pipe(assert.end(done));
	});
	
	it('should sync nested keys', function (done) {
		var primary = {
			one: 1,
			deep: {
				two: 2,
				nested: {
					value: 3
				}
			}
		};
		var target = {
			gone: 0,
			deep: {
				gone: 0,
				nested: {
					gone: 0
				}
			}
		};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.end(done));
	});
	
	it('should scaffold new structures from primary', function (done) {
		var primary = {
			deep: {
				nested: {
					value: 3
				}
			}
		};
		var target = {};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.end(done));
	});
	
	it('should clear out structures from target', function (done) {
		var primary = {};
		var target = {
			deep: {
				nested: {
					value: 3
				}
			}
		};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.end(done));
	});
	
	it('should not inspect or sync array contents', function (done) {
		var primary = {
			arr: [{
				one: 1
			}, {
				two: 2
			}]
		};
		var target = {
			arr: [{
				three: 3
			}, {
				four: 4
			}]
		};
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(target)))
			.pipe(assert.end(done));
	});
	
	it('should sync multiple targets', function (done) {
		var primary = {
			one: 1
		};
		var targetOne = {
			gone: 0
		};
		var targetTwo = {
			one: 2
		};
		var targetThree = {
			one: 3,
			gone: 0	
		};
		test(primary, targetOne, targetTwo, targetThree)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.nth(2, contentsAre({ one: 2 })))
			.pipe(assert.nth(3, contentsAre({ one: 3 })))
			.pipe(assert.end(done));
	});
	
	it('should push to empty objects', function (done) {
		var primary = { one: 1 };
		test(primary, {})
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.end(done));
	});
	
	it('should push to empty files', function (done) {
		var primary = { one: 1 };
		test(primary, "")
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.end(done));
	});
	
	it('should push to whitespace files', function (done) {
		var primary = { one: 1 };
		test(primary, " \r\n \t ")
			.pipe(syncJSON('file0.json'))
			.pipe(assert.second(contentsAre(primary)))
			.pipe(assert.end(done));
	});
	
	it('should emit error when trying to sync against an array', function(done) {
		var primary = { one: 1 };
		test(primary, [0, 1])
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('is a JSON type that cannot be synced: Array. Only Objects are supported');
				done();
	        });
	});
	
	it('should emit error when trying to sync against a number', function(done) {
		var primary = { one: 1 };
		test(primary, 42)
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('is a JSON type that cannot be synced: Number. Only Objects are supported');
				done();
	        });
	});
	
	it('should emit error when trying to sync against a string', function(done) {
		var primary = { one: 1 };
		test(primary, "\"hello world\"")
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('is a JSON type that cannot be synced: String. Only Objects are supported');
				done();
	        });
	});
	
	it('should emit error when trying to sync against a boolean', function(done) {
		var primary = { one: 1 };
		test(primary, true)
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('is a JSON type that cannot be synced: Boolean. Only Objects are supported');
				done();
	        });
	});
		
	it('should emit error when trying to sync against null', function(done) {
		var primary = { one: 1 };
		test(primary, null)
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('is a JSON type that cannot be synced: Null. Only Objects are supported');
				done();
	        });
	});
	
	it('should emit error for invalid JSON in primary', function(done) {
		var primary = "not json";
		var target = { one: 1 };
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('contains invalid JSON');
				done();
	        });
	});
	
	it('should emit error for invalid JSON in target', function(done) {
		var primary = { one: 1 };
		var target = "not json";
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('contains invalid JSON');
				done();
	        });
	});
		
	it('should not try to parse ignored files', function (done) {
		var primary = "not json";
		test(primary)
			.pipe(syncJSON('file0.json'))
			.pipe(assert.length(1))
			.pipe(assert.end(done));
	})

	it('should emit error when types are mismatched on matching keys', function(done) {
		var primary = { badKey: 1 };
		var target = { badKey: "two" }
		test(primary, target)
			.pipe(syncJSON('file0.json'))
			.on('error', function (err) {
				chalk.stripColor(err.message).should.endWith('contains type mismatch on key badKey. Source type number, target type string');
				done();
	        });
	});
});