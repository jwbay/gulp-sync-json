/* global __dirname, Buffer, describe, it*/
var gulp = require('gulp');
var assert = require('stream-assert');
var path = require('path');
var should = require('should');
var syncJSON = require('../');
var test = require('./test-stream');
require('mocha');

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
			.pipe(assert.second(contentsAre({
				one: 1
			})))
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
});