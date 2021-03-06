'use strict';

const denodeify = require('denodeify');
const debug = require('debug')('DependencyGraph');
const fs = require('graceful-fs');
const path = require('../fastpath');

const readDir = denodeify(fs.readdir);
const stat = denodeify(fs.stat);

function nodeRecReadDir(roots, {ignore, exts}) {
  const queue = roots.slice();
  const retFiles = [];
  const extPattern = new RegExp(
    '\.(' + exts.join('|') + ')$'
  );

  function search() {
    const currDir = queue.shift();
    if (!currDir) {
      return Promise.resolve();
    }

    return readDir(currDir)
      .then(files => files.map(f => path.join(currDir, f)))
      .then(files => Promise.all(
        files.map(f => stat(f).catch(handleBrokenLink))
      ).then(stats => [
        // Remove broken links.
        files.filter((file, i) => !!stats[i]),
        stats.filter(Boolean),
      ]))
      .then(([files, stats]) => {
        files.forEach((filePath, i) => {
          if (ignore(filePath)) {
            return;
          }

          // console.log(filePath)

          if (stats[i].isDirectory()) {
            queue.push(filePath);
            return;
          }

          if (filePath.match(extPattern)) {
            retFiles.push(path.resolve(filePath));
          }
        });

        return search();
      });
  }

  return search().then(() => retFiles);
}

function handleBrokenLink(e) {
  debug('WARNING: error stating, possibly broken symlink', e.message);
  return Promise.resolve();
}

module.exports = nodeRecReadDir;
