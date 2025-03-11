import * as fs from "node:fs";
import * as path from "node:path";
import * as vm from "node:vm";
import { cachedDataVersionTag } from "node:v8";
// import { warn } from "../adapters/logger.js";

export function applyV8Cache() {
  // warn("You are using the experimental V8 cache feature.");
  // warn("System information:");
  // warn(JSON.stringify(getV8CacheInfo()));
  const Module = require("node:module");
  //@ts-ignore
  const _previousCompile = Module.prototype._compile;

  //@ts-ignore
  Module.prototype._compile = function (content, filename) {
    console.time(`compile ${filename}`);
    const mod = this;
    function require(id: any) {
      return mod.require(id);
    }
    function resolve(request: any, options: any) {
      // @ts-ignore
      return Module._resolveFilename(request, mod, false, options);
    }
    require.resolve = resolve;

    // https://github.com/nodejs/node/blob/v10.15.3/lib/internal/modules/cjs/helpers.js#L37
    // resolve.resolve.paths was added in v8.9.0
    resolve.paths = function paths(request: any) {
      // @ts-ignore
      return Module._resolveLookupPaths(request, mod, true);
    };

    // Enable support to add extra extension types
    //@ts-ignore
    require.extensions = Module._extensions;
    //@ts-ignore
    require.cache = Module._cache;
    const relativePath = path.relative(__dirname, filename);
    const cachedFile = `${path.join(__dirname, ".next", "v8-cache", relativePath)}.cache`;

    // @ts-ignore
    const wrapper = Module.wrap(content);
    if (fs.existsSync(cachedFile)) {
      try {
        const script = new vm.Script(wrapper, {
          lineOffset: 0,
          cachedData: fs.readFileSync(cachedFile),
          filename,
        });
        if (script.cachedDataRejected) {
          console.log("rejected cachedData", filename);
          return _previousCompile.call(this, content, filename);
        }
        const compiledWrapper = script.runInThisContext({
          lineOffset: 0,
          columnOffset: 0,
          displayErrors: true,
        });
        const dirname = path.dirname(filename);
        const args = [
          mod.exports,
          require,
          mod,
          filename,
          dirname,
          process,
          global,
          Buffer,
        ];
        const result = compiledWrapper.apply(mod.exports, args);
        console.timeEnd(`compile ${filename}`);
        return result;
      } catch (e) {
        console.log("error", e, filename);
        return _previousCompile.call(this, content, filename);
      }
    }

    const result = _previousCompile.call(this, content, filename);
    console.timeEnd(`compile ${filename}`);
    return result;
  };
}

export function getV8CacheInfo() {
  return {
    arch: process.arch,
    nodeVersion: process.version,
    v8Version: process.versions.v8,
    nodeArgs: process.execArgv,
    cachedDataVersionTag: cachedDataVersionTag(),
  };
}
