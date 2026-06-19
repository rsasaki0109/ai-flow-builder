import { describe, expect, it } from "vitest";

describe("flow-core test environment", () => {
  it("runs a smoke test", () => {
    expect("flow-core").toBe("flow-core");
  });
});
