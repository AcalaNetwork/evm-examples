'use strict';

const fixedDeps = {
  "@polkadot/api": "~6.4.2",
  "@polkadot/types": "~6.4.2",
  "@polkadot/rpc-core": "~6.4.2",
} 

/**
 * This hook is invoked during installation before a package's dependencies
 * are selected.
 * The `packageJson` parameter is the deserialized package.json
 * contents for the package that is about to be installed.
 * The `context` parameter provides a log() function.
 * The return value is the updated object.
 */
function readPackage(packageJson, context) {
  for(const dep of Object.keys(fixedDeps)) {
    if(packageJson.dependencies[dep]) {
      context.log(`resolved ${packageJson.name} to use ${dep}@${fixedDeps[dep]}`);
      packageJson.dependencies[dep] = fixedDeps[dep]
    }
  }

  return packageJson;
}

module.exports = {
  hooks: {
    readPackage
  }
};