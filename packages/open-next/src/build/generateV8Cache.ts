import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Script } from "node:vm";
import { getV8CacheInfo } from "utils/v8.js";
import logger from "../logger.js";
import Module from "node:module";

interface GenerateV8CacheOptions {
  outputDir: string;
  outputNextDir: string;
  filesToCopy: Map<string, string>;
}

export function generateV8Cache({
  outputDir,
  outputNextDir,
  filesToCopy,
}: GenerateV8CacheOptions) {
  logger.info("You are using the experimental V8 cache feature.");
  logger.info("System information:");
  logger.info(JSON.stringify(getV8CacheInfo()));

  const v8CacheDir = path.join(outputNextDir, "v8-cache");
  // Here we are going to generate v8 cache files for every traced js files
  filesToCopy.forEach((to, from) => {
    // We need to see what we should do for esm modules
    if (from.endsWith(".js")) {
      const script = readFileSync(from, "utf8");
      const wrapper = Module.wrap(script);
      const cachedData = new Script(wrapper, {
        lineOffset: 0,
      }).createCachedData();
      const v8CachePath = `${path.join(v8CacheDir, path.relative(outputDir, to))}.cache`;
      mkdirSync(path.dirname(v8CachePath), { recursive: true });
      writeFileSync(v8CachePath, cachedData);
    }
  });
}
