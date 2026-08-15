import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PiRpcClient } from "@/lib/agent/pi-rpc";

describe("Pi RPC JSONL client", () => {
  it("waits for agent_end after the prompt acknowledgement and parses structured output", async () => {
    const previousBinary = process.env.GENFORGE_PI_BIN;
    process.env.GENFORGE_PI_BIN = path.join(process.cwd(), "tests/fixtures/fake-pi.mjs");
    const client = new PiRpcClient();
    try {
      const result = await client.promptStructured("Return an empty claim list", z.object({ claims: z.array(z.unknown()) }));
      expect(result.claims).toEqual([]);
    } finally {
      await client.close();
      if (previousBinary) process.env.GENFORGE_PI_BIN = previousBinary;
      else delete process.env.GENFORGE_PI_BIN;
    }
  });

  it("surfaces provider errors instead of parsing the echoed user prompt", async () => {
    const previousBinary = process.env.GENFORGE_PI_BIN;
    process.env.GENFORGE_PI_BIN = path.join(process.cwd(), "tests/fixtures/fake-pi.mjs");
    const client = new PiRpcClient();
    try {
      await expect(client.promptStructured("Trigger provider error", z.object({ claims: z.array(z.unknown()) }))).rejects.toThrow("Pi provider error: 401: CreditsError");
    } finally {
      await client.close();
      if (previousBinary) process.env.GENFORGE_PI_BIN = previousBinary;
      else delete process.env.GENFORGE_PI_BIN;
    }
  });

  it("aborts a live turn when its signal is cancelled", async () => {
    const previousBinary = process.env.GENFORGE_PI_BIN;
    process.env.GENFORGE_PI_BIN = path.join(process.cwd(), "tests/fixtures/fake-pi.mjs");
    const client = new PiRpcClient();
    const controller = new AbortController();
    try {
      const pending = client.promptStructured("slow test", z.object({ claims: z.array(z.unknown()) }), [], controller.signal);
      setTimeout(() => controller.abort(), 20);
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      await client.close();
      if (previousBinary) process.env.GENFORGE_PI_BIN = previousBinary;
      else delete process.env.GENFORGE_PI_BIN;
    }
  });
});
