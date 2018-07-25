/* eslint prefer-arrow-callback: "warn" */
"use strict";

global.__version = require("./package.json").version;

const Promise = require("bluebird");
const AtImport = require("postcss-import");
const Chalk = require("chalk");
const CSSnano = require("cssnano");
const CSSnext = require("postcss-cssnext");
const Del = require("del");
const FS = Promise.promisifyAll(require("fs"));
const Path = require("path");
const PostCSS = require("postcss");
const Program = require("commander");
const Watch = require("watch");

//
// Builds all stylesheets.
//
// Returns a promise.
//
function buildStyles() {
  return (
    Promise.resolve()
      // Create the dist folder if it doesn't exist
      .then(() => {
        if (!FS.existsSync(Path.join(__dirname, "dist"))) {
          return FS.mkdirAsync(Path.join(__dirname, "dist"));
        }
      })

      // Generate minified stylesheet
      .then(() => {
        let file = Path.join(__dirname, "source/css/shoelace.css");
        let css = FS.readFileSync(file, "utf8");

        return PostCSS([
          AtImport,
          CSSnext({
            features: {
              rem: false
            }
          }),
          CSSnano({
            autoprefixer: false,
            safe: true
          })
        ]).process(css, { from: file });
      })

      // Write stylesheet to dist
      .then(result => {
        let file = Path.join(__dirname, "dist/shoelace.css");

        // Update {{version}} in CSS since it's not processed with Handlebars
        result.css = result.css.replace(/\{\{version\}\}/g, __version);

        // Output a message
        console.log(
          Chalk.green("CSS processed: %s! 🦋"),
          Path.relative(__dirname, file)
        );

        // Write output file
        return FS.writeFileAsync(file, result.css, "utf8");
      })
  );
}

//
// Watches a directory for changes
//
//  - options (object)
//    - path (string) - the path of the directory to watch.
//    - ready (function) - callback to execute after initializing.
//    - change (function(event, file)) - callback to execute when a file is changed.
//
// No return value.
//
function watch(options) {
  options = options || {};

  Watch.watchTree(
    options.path,
    {
      ignoreDotFiles: true,
      interval: 1
    },
    (file, current, previous) => {
      if (typeof file === "object" && previous === null && current === null) {
        if (typeof options.ready === "function") options.ready();
      } else if (previous === null) {
        if (typeof options.change === "function")
          options.change({ type: "created" }, file);
      } else if (current.nlink === 0) {
        if (typeof options.change === "function")
          options.change({ type: "deleted" }, file);
      } else {
        if (typeof options.change === "function")
          options.change({ type: "modified" }, file);
      }
    }
  );
}

// Initialize CLI
Program.version(__version)
  .option("--build", "Builds a release")
  .option("--clean", "Removes existing release")
  .option("--watch", "Watch for changes and build automatically")
  .on("--help", () => {
    console.log(Chalk.cyan("\n  Version %s\n"), __version);
    process.exit(1);
  })
  .parse(process.argv);

// Show help by default
if (!process.argv.slice(2).length) {
  Program.outputHelp();
  process.exit(1);
}

// Build
if (Program.build) {
  Promise.resolve()
    // Remove the dist folder
    .then(() => Del(Path.join(__dirname, "dist")))

    // Build styles
    .then(() => buildStyles())

    // Exit with success
    .then(() => process.exit(1))

    // Handle errors
    .catch(err => {
      console.error(Chalk.red(err));
      process.exit(-1);
    });
}

// Clean
if (Program.clean) {
  Promise.resolve()
    // Delete /dist
    .then(() => Del(Path.join(__dirname, "dist")))
    .then(() => {
      console.log(Chalk.green("/dist has been removed."));
    })

    // Exit with success
    .then(() => process.exit(1))

    // Handle errors
    .catch(err => {
      console.error(Chalk.red(err));
      process.exit(-1);
    });
}

// Watch
if (Program.watch) {
  // Watch styles
  watch({
    path: Path.join(__dirname, "source/css"),
    ready: () => console.log(Chalk.cyan("Watching for style changes...")),
    change: event => {
      if (event.type === "created" || event.type === "modified") {
        buildStyles();
      }
    }
  });
}
