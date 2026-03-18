import { describe, it, expect } from "vitest";
import { Rampup } from "../src/core.js";
describe("Rampup", () => {
  it("init", () => { expect(new Rampup().getStats().ops).toBe(0); });
  it("op", async () => { const c = new Rampup(); await c.process(); expect(c.getStats().ops).toBe(1); });
  it("reset", async () => { const c = new Rampup(); await c.process(); c.reset(); expect(c.getStats().ops).toBe(0); });
});
