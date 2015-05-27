# gulp-sync-json
[Gulp](http://gulpjs.com/) plugin for synchronizing JSON file key structures
against a primary source

## What it's for
This plugin can synchronize the key structures of JSON files. It must be
provided a 'source of truth', or primary filename. For each directory it
encounters, the plugin will make all JSON files present conform to that
directory's primary file's key structure. It is recursive, so it handles
nested key structures as one would expect.

## What it's not for
* It does not synchronize values. It only synchronizes keys.
* It cannot synchronize files across different directories.
* It will not synchronize array structures, including objects inside arrays.
 Arrays are treated as primitives; only objects are recursed and processed.

## License
MIT License (Expat)

## Example
Given these files:

a.json
```json
{
    "key_one": "value",
    "key_two": 42,
    "nested": {
        "key": "nested value"
    }
}
```
b.json
```json
{
    "key_two": 100,
    "nested": {
        "key": "different value",
        "other_key": "other value"
    }
}
```
Running the plugin with a.json as the primary file will change b.json to the
following:
```json
{
    "key_one": "value",
    "key_two": 100,
    "nested": {
        "key": "different value"
    }
} 
```

## Usage
To make all JSON files within the cwd conform to an 'en.json' sibling file:
```javascript
var gulp = require('gulp');
var syncJSON = require('gulp-sync-json');

gulp.task('sync-json', function() {
    return gulp.src('./**/*.json')
        .pipe(syncJSON('en.json'))
        .pipe(gulp.dest('./'));
});
```

### `syncJSON(primaryFile: string, options?: any) => NodeJS.ReadWriteStream`

#### primaryFile
A filename, or the basename portion of a path, that is the source of truth for
key structure for every other JSON file in the directory

#### options
An optional options object. The following properties are supported:

* `report: boolean` - Default `false`. If set to `true`, the plugin will emit an
error if any key mismatches are detected instead of fixing them on the
filesystem. It will still log the mismatches. Intended for use as part of a
CI/build server step
* `spaces: number` - Default `4`. How many spaces to use when formatting JSON.
Passed directly to JSON.stringify

## Notes on behavior

#### Keys
* When filling in a new key, the plugin will use the value from the primary file
* When the plugin encounters a key not present in the primary file, it will
remove it
* If a key is present in both a source and target file but the value types do
not match, the plugin with emit an error with the file, key, and types. No
changes will be written to the filesystem. If the plugin is in report mode,
the error will be logged instead of emitted and the plugin will continue.

#### Files
* If a directory has JSON files but no filename matches the primary filename,
the directory's contents will be ignored
* If a directory has a file that matches the primary filename but no other JSON
files, the directory's contents will be ignored
* Only files the plugin is concerned with are piped through the stream, so if a
file is ignored via the rules above, it will not be passed downstream
* As a consequence of reserialization, all files touched besides the primary
file are re-formatted
* This plugin strips any present [BOM](http://unicode.org/faq/utf_bom.html#BOM)
from files it touches

Need to handle line endings differently? Pipe the results through 
[gulp-eol](https://www.npmjs.com/package/gulp-eol).