/**
 * @local/dsh-bg-tool — persistent rembg GPU background-removal tool.
 *
 * Bundle plugin in the same form as @anionex/dsh-vision-toolkit:
 * - registers the `remove_background` model tool for every agent (no skill gate);
 * - registers a plugin configuration card (Settings > Plugins > 插件配置) backed
 *   by the plugin's own settings route: GET layered snapshot (value/base/user)
 *   and POST field-level mutate ops — model mapping per mode, output directory,
 *   and server auto-start;
 * - manages the local rembg server lifecycle: ensures the GPU server on
 *   http://127.0.0.1:7000 is running (started hidden/detached at apply or on
 *   demand), so the tool survives DSH restarts.
 * The venv and models live under the workspace .bg-tools directory.
 * @module @local/dsh-bg-tool
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

export const name = '@local/dsh-bg-tool';
export const inject = ['tools', 'settings'];

const BG_ROOT = 'E:/ProjectCode/DeepSeekHarnessWorkbook/.bg-tools';
const API = 'http://127.0.0.1:7000/api/remove';
const HEALTH = 'http://127.0.0.1:7000/openapi.json';
const SETTINGS_ROUTE = '/_dsh/bg-tool/settings';
const DEFAULT_OUT_DIR = path.join(BG_ROOT, 'output');

/** Settings document namespace owned by this plugin (editable via its plugin-configuration card). */
export const BG_TOOL_SETTINGS_NAMESPACE = settingsNamespace('bg-tool');

/** Models the local rembg server can load. */
export const AVAILABLE_MODELS = [
  'birefnet-general',
  'birefnet-portrait',
  'isnet-general-use',
  'u2net_human_seg',
  'u2net',
  'u2netp',
];

/** Visual configuration schema with sensible defaults. */
export const Config = z.object({
  generalModel: z.union(AVAILABLE_MODELS).default('birefnet-general'),
  portraitModel: z.union(AVAILABLE_MODELS).default('birefnet-portrait'),
  fastModel: z.union(AVAILABLE_MODELS).default('u2netp'),
  outputDir: z.string().default(DEFAULT_OUT_DIR),
  autoStartServer: z.boolean().default(true),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Probe the local rembg server. */
function serverAlive(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(HEALTH, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.setTimeout(timeoutMs);
  });
}

/** Spawn the rembg server with pythonw.exe — a GUI-subsystem binary, so it can
 * never open a console window. Detached + tracked for stop-with-DSH. */
let spawnedChild = null;

function startServerProcess() {
  const python = path.join(BG_ROOT, 'venv', 'Scripts', 'pythonw.exe');
  const script = path.join(BG_ROOT, 'bg_server.py');
  const env = {
    ...process.env,
    U2NET_HOME: path.join(BG_ROOT, 'models'),
    TMP: path.join(BG_ROOT, 'tmp'),
    TEMP: path.join(BG_ROOT, 'tmp'),
    PATH: [
      path.join(BG_ROOT, 'venv', 'Lib', 'site-packages', 'nvidia', 'cu13', 'bin', 'x86_64'),
      path.join(BG_ROOT, 'venv', 'Lib', 'site-packages', 'nvidia', 'cudnn', 'bin'),
      process.env.PATH ?? '',
    ].join(';'),
  };
  const child = spawn(python, [script], {
    cwd: BG_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env,
  });
  child.unref();
  spawnedChild = child;
  return child;
}

/** Kill the server we spawned (called on plugin dispose / DSH shutdown). */
function stopSpawnedServer() {
  if (spawnedChild !== null && !spawnedChild.killed) {
    try {
      spawnedChild.kill();
    } catch {
      // already gone
    }
    spawnedChild = null;
  }
}

/** Ensure the server is up; returns true when it answers. */
async function ensureServer() {
  if (await serverAlive()) return true;
  startServerProcess();
  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    if (await serverAlive()) return true;
  }
  return false;
}

/** Current settings snapshot for the Web UI (no secrets). */
function settingsSnapshot(webCtx) {
  const descriptor = webCtx.settings.describe().find((row) => row.ns === BG_TOOL_SETTINGS_NAMESPACE);
  return {
    writable: webCtx.settings.writable,
    settings: {
      value: descriptor?.value ?? {},
      revision: descriptor?.revision ?? 0,
      ...(descriptor?.base === undefined ? {} : { base: descriptor.base }),
      ...(descriptor?.user === undefined ? {} : { user: descriptor.user }),
    },
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function collectBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** GET: settings snapshot. POST { action: 'mutate', ops, expectedRevision }: field-level write. */
async function handleSettingsRequest(webCtx, req, res) {
  try {
    if (req.method === 'GET') {
      sendJson(res, 200, { ok: true, value: settingsSnapshot(webCtx) });
      return;
    }
    if (req.method === 'POST') {
      const body = JSON.parse(await collectBody(req));
      if (body?.action !== 'mutate') {
        sendJson(res, 400, { ok: false, error: { message: 'unknown action' } });
        return;
      }
      // Field-level path ops ({op:'set'|'unset', path:[field]}) — mirrors the
      // official settings.mutate wire so only touched fields enter the user layer.
      if (!webCtx.settings.writable) throw new Error('settings provider is read-only');
      await webCtx.settings.mutate(BG_TOOL_SETTINGS_NAMESPACE, Array.isArray(body.ops) ? body.ops : [], body.expectedRevision);
      sendJson(res, 200, { ok: true, value: settingsSnapshot(webCtx) });
      return;
    }
    sendJson(res, 405, { ok: false, error: { message: 'method not allowed' } });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: { message: String(err?.message ?? err) } });
  }
}

/** Plugin entry. */
export async function apply(ctx, config = {}) {
  const disposers = [];
  const settings = ctx.settings.register(BG_TOOL_SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'live',
  });

  // Web settings route backing the client settings section.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const disposeRoute = webCtx.webServer.register({
        kind: 'exact',
        path: SETTINGS_ROUTE,
        handler: (req, res) => handleSettingsRequest(webCtx, req, res),
      });
      return () => disposeRoute();
    }, 'dsh-bg-tool: settings route');
  });

  // Warm the server without blocking registration.
  ensureServer()
    .then((ok) => {
      ctx.logger?.info?.('dsh-bg-tool: rembg server %s', ok ? 'ready' : 'unavailable (will retry on first call)');
    })
    .catch(() => {});

  const tool = defineTool({
    name: 'remove_background',
    description: 'Remove the background of an image using the local rembg GPU service (抠图/去背景). ' +
      'Modes: "general" = BiRefNet-general fp16 (best for arbitrary objects, products, photos); ' +
      '"portrait" = BiRefNet-portrait fp16 (best for people, hair, ID photos); ' +
      '"fast" = u2netp quick draft. ' +
      'The model per mode, the output directory, and server auto-start are configurable in Settings > bg-tool. ' +
      'Typical warm latency ~1s per image; first call for a model takes ~7s (loads into GPU memory). ' +
      'Result is a transparent-background PNG saved under the configured output directory and output_path is returned.',
    parameters: {
      image_path: { type: 'string', required: true, description: 'Absolute path of the input image (jpg/png/webp). Use forward slashes (/) in the path, e.g. E:/ProjectCode/photo.png, never backslashes.' },
      mode: { type: 'string', required: true, enum: ['general', 'portrait', 'fast'], description: 'Which segmentation model group to use.' },
      output_name: { type: 'string', description: 'Optional output PNG filename. Defaults to <input-stem>_<mode>.png' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const cfg = settings.get();
      const models = {
        general: cfg.generalModel,
        portrait: cfg.portraitModel,
        fast: cfg.fastModel,
      };
      const mode = String(args.mode || 'general');
      const model = models[mode] || models.general;
      const input = String(args.image_path);
      const outDir = String(cfg.outputDir || DEFAULT_OUT_DIR);

      let buf;
      try {
        buf = await fsp.readFile(input);
      } catch (err) {
        return { ok: false, output_path: null, mode, model, message: '无法读取输入图片: ' + String(err?.message ?? err) };
      }
      const stem = path.basename(input).replace(/\.[^./]+$/, '');
      const outName = args.output_name ? String(args.output_name).replace(/[\\/]/g, '_') : `${stem}_${mode}.png`;
      const outPath = path.join(outDir, outName);

      if (cfg.autoStartServer) {
        if (!(await ensureServer())) {
          return { ok: false, output_path: null, mode, model, message: 'rembg 服务无法启动，请检查 .bg-tools 环境（venv/models）' };
        }
      } else if (!(await serverAlive())) {
        return { ok: false, output_path: null, mode, model, message: 'rembg 服务未运行（设置中关闭了自动启动），请先运行 .bg-tools\\start-server.ps1' };
      }

      const fd = new FormData();
      fd.append('file', new Blob([buf]), path.basename(input));
      fd.append('model', model);

      let res;
      try {
        res = await fetch(API, { method: 'POST', body: fd, signal: exec.signal });
      } catch (err) {
        return { ok: false, output_path: null, mode, model, message: '调用 rembg 服务失败: ' + String(err?.message ?? err) };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, output_path: null, mode, model, message: `rembg 服务 HTTP ${res.status}: ${text.slice(0, 300)}` };
      }
      const png = Buffer.from(await res.arrayBuffer());
      await fsp.mkdir(outDir, { recursive: true });
      await fsp.writeFile(outPath, png);
      return { ok: true, output_path: outPath, mode, model, message: `抠图成功，输出: ${outPath}` };
    },
  });

  disposers.push(ctx.tools.register(tool));
  return () => {
    for (const dispose of disposers) dispose();
    stopSpawnedServer();
  };
}
