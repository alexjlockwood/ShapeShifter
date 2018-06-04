const semver = require('semver');
const engines = require('../package.json').engines;
const version = engines.node;

if (!semver.satisfies(process.version, version)) {
  console.error(
    'ERROR! The version of node on your machine is out of date (current: ' +
      process.version +
      ', required: ' +
      version +
      ').\n',
  );
  process.exit(1);
}
