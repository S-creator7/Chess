const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch the entire monorepo
config.watchFolders = [workspaceRoot];

// Resolve dependencies from the mobile app and workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Let Metro resolve dependencies through the monorepo hierarchy
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
