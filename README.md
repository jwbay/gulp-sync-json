# gulp-sync-json
Synchronize JSON file key structures against a primary source

### What it's for
This plugin can synchronize the key structures of JSON files that are all
within the same directory. It must be provided a 'source of truth', or primary
file. It will make all other JSON files conform to the primary file's key
structure. It is recursive, so it handles nested key structures as one
would expected.

### What it's not for
* It does not synchronize values. It only synchronizes keys.
* It cannot synchronize across directories.
* It will not synchronize array structures. Arrays are treated as primitives;
only objects are recursed and processed.

### Usage
To make all JSON files within the cwd conform to an 'en.json' sibling file:
```javascript
import gulp = require('gulp');
import syncJSON = require('gulp-sync-json');

gulp.src('./**/*.json')
    .pipe(syncJSON('en.json'))
    .pipe(gulp.dest('./'));
```

`syncJSON(primaryFile: string, options?: any)`

#### primaryFile
A filename, or the basename portion of a path, that is the source of truth for
key structure for every other JSON file in the directory

#### options
An optional options object. Currently supports one option:

* `report`: if set to `true`, the plugin will throw an error if any key
mismatches are detected instead of fixing them on the filesystem. It will still
log the mismatches. Intended for use as part of a CI/build server step
