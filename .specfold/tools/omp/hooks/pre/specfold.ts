/**
 * Specfold's omp hooks. Each event is forwarded to a `specfold hook claude-*` subcommand, so the
 * checks live in the CLI and Claude Code and omp share them. A command that cannot run (missing
 * script, spawn error, timeout, an exit other than 0 or 2) never blocks or fails an omp event.
 * Installed as .omp/hooks/pre/specfold.ts when specfold.yaml lists omp in `tools`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** The parts of omp's hook context the adapter reads; omp's types are not imported, so vitest loads the file. */
export interface OmpContext {
  sessionManager?: {
    getCwd?(): string;
    getSessionId?(): string;
    getHeader?(): { parentSession?: unknown } | null | undefined;
  };
}

export type OmpHandler = (event: never, ctx: OmpContext) => unknown;

export interface OmpApi {
  on(event: string, handler: OmpHandler): void;
}

interface ToolCallEvent {
  toolName?: unknown;
  input?: { command?: unknown };
}

interface ToolResultEvent {
  toolName?: unknown;
  input?: { path?: unknown; paths?: unknown };
  isError?: unknown;
}

interface Reply {
  code: 0 | 2;
  stdout: string;
  stderr: string;
}

const TIMEOUT_MS = 60_000;
/** omp's file tools and the Claude Code tool names `claude-post-tool-use` checks. */
const EDIT_TOOLS = new Map([
  ["edit", "Edit"],
  ["write", "Write"],
]);

const cwdOf = (ctx: OmpContext) => ctx.sessionManager?.getCwd?.() ?? process.cwd();

/** A task subagent's session header names its parent session; a main session's does not. */
const isSubagent = (ctx: OmpContext) => Boolean(ctx.sessionManager?.getHeader?.()?.parentSession);

/** The nearest directory at or above `dir` holding specfold.yaml. */
function repoRoot(dir: string): string | undefined {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, "specfold.yaml"))) return d;
    if (dirname(d) === d) return undefined;
  }
}

/** Runs `specfold hook <name>` in the repository root with `event` as JSON on stdin; undefined if it can't run. */
function hook(cwd: string, name: string, event: object): Reply | undefined {
  const root = repoRoot(cwd);
  if (!root) return undefined;
  const script = join(root, "scripts", "specfold.mjs");
  if (!existsSync(script)) return undefined;
  // omp is a compiled Bun binary, so process.execPath is omp itself; BUN_BE_BUN=1 makes it run the
  // script as Bun would, and node ignores the variable
  const result = spawnSync(process.execPath, [script, "hook", name], {
    cwd: root,
    env: { ...process.env, BUN_BE_BUN: "1" },
    input: JSON.stringify(event),
    encoding: "utf8",
    timeout: TIMEOUT_MS,
  });
  if (result.error || (result.status !== 0 && result.status !== 2)) return undefined;
  return { code: result.status === 2 ? 2 : 0, stdout: result.stdout, stderr: result.stderr };
}

/** A handler that returns nothing instead of throwing, so the adapter never fails an omp event. */
function safe<E>(handler: (event: E, ctx: OmpContext) => unknown): (event: E, ctx: OmpContext) => unknown {
  return (event, ctx) => {
    try {
      return handler(event, ctx);
    } catch {
      return undefined;
    }
  };
}

export default function specfold(pi: OmpApi): void {
  // before_agent_start fires before every run, also after a blocked stop: inject once per main session
  const started = new Set<string>();

  pi.on(
    "before_agent_start",
    safe((_event: unknown, ctx) => {
      if (isSubagent(ctx)) return undefined;
      const session = ctx.sessionManager?.getSessionId?.() ?? "";
      if (started.has(session)) return undefined;
      started.add(session);
      const cwd = cwdOf(ctx);
      const reply = hook(cwd, "claude-session-start", { cwd });
      const content = reply?.code === 0 ? reply.stdout.trimEnd() : "";
      return content === "" ? undefined : { message: { customType: "specfold", content, display: false } };
    }),
  );

  pi.on(
    "tool_result",
    safe((event: ToolResultEvent, ctx) => {
      const tool = typeof event.toolName === "string" ? EDIT_TOOLS.get(event.toolName) : undefined;
      if (!tool || event.isError) return undefined;
      const path = event.input?.path;
      const paths = event.input?.paths;
      const files = new Set([
        ...(typeof path === "string" ? [path] : []),
        ...(Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string") : []),
      ]);
      const cwd = cwdOf(ctx);
      const errors = [...files].flatMap((file) => {
        const input = { tool_name: tool, tool_input: { file_path: file }, cwd };
        const reply = hook(cwd, "claude-post-tool-use", input);
        return reply?.code === 2 && reply.stderr.trim() !== "" ? [reply.stderr.trimEnd()] : [];
      });
      return errors.length === 0 ? undefined : { additionalContext: errors.join("\n") };
    }),
  );

  // omp fires session_stop for main sessions only
  pi.on(
    "session_stop",
    safe((_event: unknown, ctx) => {
      const reply = hook(cwdOf(ctx), "claude-stop", {});
      return reply?.code === 2 ? { decision: "block", reason: reply.stderr.trimEnd() } : undefined;
    }),
  );

  // the implementer's no-push guard; a main session's pushes are left to bash.patterns
  pi.on(
    "tool_call",
    safe((event: ToolCallEvent, ctx) => {
      if (event.toolName !== "bash" || !isSubagent(ctx)) return undefined;
      const command = event.input?.command;
      if (typeof command !== "string") return undefined;
      const reply = hook(cwdOf(ctx), "claude-no-push", { tool_input: { command } });
      return reply?.code === 2 ? { block: true, reason: reply.stderr.trimEnd() } : undefined;
    }),
  );
}
