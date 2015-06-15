#1.1.0
* Massive refactor; if it wasn't covered by tests it probably broke
* Fixed: when a complex object is removed, its contained keys are now properly
logged in verbose mode
* Fixed: unsupported root-level JSON types can no longer cause files to get
dropped from the stream
* Changed: invalid JSON errors are no longer supressed in report mode;
instead they are always emitted onto the stream. Other Gulp plugins do JSON
linting much better than I'm interested in doing here
* Feature: added `errorOnReportFail` option to determine whether a report
failure emits an error onto the stream
* Changed: getting a non-zero exit code from the plugin now requires the 
`errorOnReportFail` option to be set to `true`

#1.0.5
* Test coverage (finally)
* Feature: add `verbose` option to toggle key action logging
* Changed: key action logging now requires the `verbose` option to be set
to `true`

#1.0.4
* Changed: in report mode, log out failures and then emit an error instead of
 emitting a complex multi-line error message. Should play more nicely with CI
 servers

#1.0.3
* Changed: fail report for mixed types on the same key
* Fixed: pass all files downstream, not just files the plugin cares about
* Fixed: gracefully handle unsupported JSON instead of blowing up 

#1.0.2
* Fixed: missed recursion case, could lead to unsynced keys in complex objects
* Fixed: switched from throwing errors inside the stream to emitting error events

#1.0.1
* Feature: support all JSON value types, not just objects and strings
* Feature: add `spaces` option for JSON serialization