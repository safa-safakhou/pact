import { registerHooks } from "node:module";

// Enforce the runtime closure, not just the fixture's direct imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    const path = new URL(result.url).pathname;
    const match = /\/packages\/([^/]+)\/dist\/(.+)$/.exec(path);
    if (match) {
      const [, name, file] = match;
      const allowed =
        name === "model-provider" ||
        (name === "identity" && ["portable.js", "crypto.js", "types.js"].includes(file)) ||
        (["runs", "approvals", "inbox"].includes(name) && file === "portable.js");
      if (!allowed) throw new Error(`NON_GAME_FORBIDDEN_IMPORT: ${name}/${file}`);
    }
    if (!specifier.startsWith("node:") && !match && !path.includes("/.tmp/non-game/"))
      throw new Error(`NON_GAME_FORBIDDEN_IMPORT: ${specifier}`);
    return result;
  },
});
