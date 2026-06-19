import { describe, expect, it } from "vitest";
import { builtInNodeSpecs } from "./builtins.js";
import {
  findNodeSpec,
  getNodeSpec,
  listNodeSpecs,
  UnknownNodeSpecError,
} from "./registry.js";

describe("node spec registry", () => {
  it("lists built-in node specs", () => {
    expect(listNodeSpecs()).toEqual(builtInNodeSpecs);
  });

  it("looks up a spec by kind and version", () => {
    expect(getNodeSpec("core.input.text", 1).displayName).toBe("Text Input");
    expect(findNodeSpec("core.output.text", 1)?.category).toBe("output");
  });

  it("returns null or throws typed errors for unknown specs", () => {
    expect(findNodeSpec("core.input.text", 2)).toBeNull();
    expect(findNodeSpec("unknown.node", 1)).toBeNull();

    expect(() => getNodeSpec("core.input.text", 2)).toThrow(
      UnknownNodeSpecError,
    );

    try {
      getNodeSpec("unknown.node", 1);
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownNodeSpecError);
      expect(error).toMatchObject({
        kind: "unknown.node",
        version: 1,
      });
    }
  });
});
