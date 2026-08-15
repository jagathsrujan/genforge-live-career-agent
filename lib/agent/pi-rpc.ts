import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { z } from "zod";
import { getDataDir, redactLogText } from "../storage";

type RpcMessage = Record<string, unknown> & { type?: string; id?: string };
type ImageInput = { mimeType: string; data: string };
type PiRpcClientOptions = { model?: string; thinking?: string };

function textFromContent(content: unknown): string {
  if (typeof content === "string" && content.trim()) return content.trim();
  if (!Array.isArray(content)) {
    if (content && typeof content === "object") {
      const item = content as Record<string, unknown>;
      if (typeof item.text === "string" && item.text.trim()) return item.text.trim();
      if (typeof item.delta === "string" && item.delta.trim()) return item.delta.trim();
    }
    return "";
  }
  return content
    .filter((item) => typeof item === "object" && item !== null && (item as Record<string, unknown>).type === "text")
    .map((item) => (item as Record<string, unknown>).text)
    .filter((item): item is string => typeof item === "string")
    .join("\n")
    .trim();
}

function abortError() {
  const error = new Error("Pi agent turn cancelled.");
  error.name = "AbortError";
  return error;
}

function responseText(message: RpcMessage): string {
  if (message.role === "assistant") return textFromContent(message.content);
  const assistantMessages = [message.message, message.messages].flatMap((value) => Array.isArray(value) ? value : [value]);
  for (const candidate of assistantMessages) {
    if (!candidate || typeof candidate !== "object" || (candidate as Record<string, unknown>).role !== "assistant") continue;
    const text = textFromContent((candidate as Record<string, unknown>).content);
    if (text) return text;
  }
  const directCandidates: unknown[] = [message.text, message.data, message.result, message.content, message.assistantMessageEvent];
  for (const candidate of directCandidates) {
    const text = textFromContent(candidate);
    if (text) return text;
  }
  return "";
}

function responseError(message: RpcMessage): string {
  const inspect = (value: unknown): string => {
    if (!value || typeof value !== "object") return "";
    const item = value as Record<string, unknown>;
    if (item.stopReason === "error" && typeof item.errorMessage === "string") return item.errorMessage;
    if (typeof item.errorMessage === "string" && item.errorMessage.trim()) return item.errorMessage;
    if (typeof item.error === "string" && item.error.trim()) return item.error;
    if (Array.isArray(value)) return value.map(inspect).find(Boolean) || "";
    return "";
  };
  const raw = inspect(message) || inspect(message.message) || inspect(message.messages);
  return redactLogText(raw).slice(0, 600);
}

function findBalancedJsonValues(text: string) {
  const values: unknown[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{" && text[start] !== "[") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = start; cursor < text.length; cursor += 1) {
      const character = text[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") inString = false;
        continue;
      }
      if (character === "\"") {
        inString = true;
        continue;
      }
      if (character === "{" || character === "[") depth += 1;
      if (character === "}" || character === "]") {
        depth -= 1;
        if (depth === 0) {
          try {
            values.push(JSON.parse(text.slice(start, cursor + 1)));
          } catch {
            // Keep scanning: the model may have emitted a schema example before the answer.
          }
          start = cursor;
          break;
        }
      }
    }
  }
  return values;
}

function extractJson(text: string) {
  const fencePattern = new RegExp("\\u0060\\u0060\\u0060(?:json)?\\s*([\\s\\S]*?)\\u0060\\u0060\\u0060", "gi");
  const fencedBlocks = [...text.matchAll(fencePattern)].map((match) => match[1].trim()).filter(Boolean);
  for (const candidate of [...fencedBlocks, text]) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      const values = findBalancedJsonValues(candidate);
      if (values.length) return values[values.length - 1];
    }
  }
  throw new Error("Pi did not return valid JSON.");
}

export class PiRpcClient extends EventEmitter {
  private readonly configuredModel?: string;
  private readonly configuredThinking?: string;
  private child?: ChildProcessWithoutNullStreams;
  private buffer = "";
  private pending = new Map<string, { resolve: (value: RpcMessage) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private latestAssistantText = "";

  constructor(options: PiRpcClientOptions = {}) {
    super();
    this.configuredModel = options.model;
    this.configuredThinking = options.thinking;
  }

  start() {
    if (this.child) return;
    const model = this.configuredModel || process.env.GENFORGE_PI_MODEL || "opencode/deepseek-v4-flash-free";
    const thinking = this.configuredThinking || process.env.GENFORGE_PI_THINKING || "max";
    const extension = process.env.GENFORGE_PI_EXTENSION || `${process.cwd()}/scripts/genforge-extension.mjs`;
    const args = ["--mode", "rpc", "--no-session", "--no-builtin-tools", "--extension", extension, "--provider", "opencode", "--model", model, "--thinking", thinking];
    const command = process.env.GENFORGE_PI_BIN || "pi";
    const isNodeScript = /\.m?js$/i.test(command);
    this.child = spawn(isNodeScript ? process.execPath : command, isNodeScript ? [command, ...args] : args, {
      env: { ...process.env, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR || path.join(getDataDir(), "pi") },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.on("data", (chunk: Buffer) => this.consume(chunk.toString("utf8")));
    this.child.stderr.on("data", (chunk: Buffer) => this.emit("stderr", chunk.toString("utf8")));
    this.child.on("error", (error) => this.failAll(error instanceof Error ? error : new Error("Pi process failed.")));
    this.child.on("exit", (code, signal) => {
      if (code !== 0) this.failAll(new Error(`Pi exited before completing the request (${code ?? signal ?? "unknown"}).`));
      this.child = undefined;
    });
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as RpcMessage;
          this.handleMessage(message);
        } catch {
          this.emit("malformed", line.slice(0, 500));
        }
      }
      newline = this.buffer.indexOf("\n");
    }
  }

  private handleMessage(message: RpcMessage) {
    this.emit("message", message);
    const assistantEvent = message.assistantMessageEvent && typeof message.assistantMessageEvent === "object" ? message.assistantMessageEvent as Record<string, unknown> : undefined;
    if (message.type === "message_update" && assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
      this.latestAssistantText += assistantEvent.delta;
    }
    const text = responseText(message);
    if (message.type?.includes("message") || message.type === "agent_end") {
      if (text && !(message.type === "message_update" && assistantEvent?.type === "text_delta")) this.latestAssistantText = text;
    }
    const id = typeof message.id === "string" ? message.id : undefined;
    if (id && this.pending.has(id)) {
      const pending = this.pending.get(id)!;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve(message);
      return;
    }
    if (message.type === "agent_end" && this.pending.size > 0) {
      const [id, pending] = this.pending.entries().next().value as [string, { resolve: (value: RpcMessage) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }];
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve({ ...message, text: this.latestAssistantText });
      this.latestAssistantText = "";
    }
  }

  private failAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.emit("process_error", error);
  }

  private waitForAgentEnd(timeoutMs: number, signal?: AbortSignal) {
    return new Promise<string>((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const cleanup = () => {
        clearTimeout(timer);
        this.off("message", onMessage);
        this.off("process_error", onError);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        cleanup();
        void this.abort();
        reject(abortError());
      };
      const onMessage = (message: RpcMessage) => {
        if (message.type !== "agent_end") return;
        const providerError = responseError(message);
        const text = responseText(message) || this.latestAssistantText;
        cleanup();
        this.latestAssistantText = "";
        if (providerError) {
          reject(new Error(`Pi provider error: ${providerError}`));
          return;
        }
        resolve(text);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      timer = setTimeout(() => {
        cleanup();
        reject(new Error("Pi agent turn timed out."));
      }, timeoutMs);
      this.on("message", onMessage);
      this.on("process_error", onError);
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  request(command: Record<string, unknown>, timeoutMs = 90_000, signal?: AbortSignal) {
    this.start();
    if (!this.child?.stdin.writable) return Promise.reject(new Error("Pi RPC stdin is unavailable."));
    const id = `genforge_${crypto.randomUUID()}`;
    const payload = { ...command, id };
    return new Promise<RpcMessage>((resolve, reject) => {
      let timer: NodeJS.Timeout;
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      const onAbort = () => {
        clearTimeout(timer);
        this.pending.delete(id);
        cleanup();
        void this.abort();
        reject(abortError());
      };
      timer = setTimeout(() => {
        this.pending.delete(id);
        cleanup();
        void this.abort();
        reject(new Error("Pi RPC request timed out."));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { cleanup(); resolve(value); },
        reject: (error) => { cleanup(); reject(error); },
        timer,
      });
      this.child!.stdin.write(`${JSON.stringify(payload)}\n`, "utf8");
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  async prompt(message: string, images: ImageInput[] = [], signal?: AbortSignal) {
    if (signal?.aborted) throw abortError();
    this.latestAssistantText = "";
    const completion = this.waitForAgentEnd(90_000, signal);
    completion.catch(() => undefined);
    try {
      await this.request({ type: "prompt", message, images: images.length ? images : undefined }, 90_000, signal);
      return await completion;
    } catch (error) {
      this.emit("process_error", error instanceof Error ? error : new Error("Pi prompt failed."));
      throw error;
    }
  }

  async promptStructured<T>(message: string, schema: z.ZodType<T>, images: ImageInput[] = [], signal?: AbortSignal) {
    let raw = await this.prompt(message, images, signal);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return schema.parse(extractJson(raw));
      } catch (error) {
        if (attempt === 1) throw new Error(`Pi returned invalid structured output: ${error instanceof Error ? error.message : "schema mismatch"}`);
        raw = await this.prompt(`${message}\n\nYour previous response was not valid for the required schema. Return JSON only, with no markdown or commentary.`, images, signal);
      }
    }
    throw new Error("Pi structured request failed.");
  }

  async abort() {
    if (!this.child?.stdin.writable) return;
    this.child.stdin.write(`${JSON.stringify({ type: "abort" })}\n`, "utf8");
  }

  async close() {
    await this.abort();
    this.child?.kill();
    this.child = undefined;
    this.failAll(new Error("Pi RPC client closed."));
  }
}
