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
const prettier = require("prettier");

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

        // Prettier
        result.css = prettier.format(result.css, {
          parser: "css"
        });

        // Write output file
        return FS.writeFileAsync(file, result.css, "utf8");
      })
  );
}

// Build
Promise.resolve()
  // Remove the dist folder
  .then(() => Del(Path.join(__dirname, "dist")))

  // Build styles
  .then(() => buildStyles())

  // Exit with success
  .then(() => process.exit())

  // Handle errors
  .catch(err => {
    console.error(Chalk.red(err));
    process.exit(-1);
  });
