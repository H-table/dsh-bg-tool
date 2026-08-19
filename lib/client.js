/**
 * @local/dsh-bg-tool — browser half.
 *
 * Registers ONE plugin-configuration card under Settings > Plugins > 插件配置
 * (the `settings.plugin.item` slot), reproducing the official dsh plugin-card
 * UI exactly: a collapsible card whose staged form writes the `bg-tool`
 * settings namespace through the plugin's own loopback settings route (the
 * settings wire only serves a hardcoded namespace allowlist, so third-party
 * namespaces must use their own route; revision-fenced field writes/clears
 * mirror the official settings.mutate semantics). The settings page section
 * is intentionally NOT registered — like the official bash / agent-loop /
 * web-search cards, this plugin configures itself only from the plugin
 * configuration page.
 */
window.__ModuleLoader__.load({ id: "@local/dsh-bg-tool", factory: (require) => {
var __modules = Object.create(null); var __cache = Object.create(null);
__modules["./index.js"] = function(module, exports, require, __load_) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.apply = void 0;
const React = require("react");

exports.inject = ['slots'];

const ROUTE = '/_dsh/bg-tool/settings';
const MODELS = [
  'birefnet-general',
  'birefnet-portrait',
  'isnet-general-use',
  'u2net_human_seg',
  'u2net',
  'u2netp',
];

/**
 * One call to the plugin's own settings route. The settings wire
 * (`settings.describe` in dsh-host-apiproxy) only serves a hardcoded
 * allowlist of namespaces, so a third-party namespace is never exposed to the
 * Web client; this loopback route is the plugin-owned equivalent — same
 * layered value, same revision fencing, same field-level mutate ops.
 */
async function requestRoute(payload) {
  const init = payload === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
  const response = await fetch(ROUTE, { credentials: 'same-origin', ...init });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    throw new Error(body?.error?.message ?? `request failed with HTTP ${response.status}`);
  }
  return body.value;
}

/** SettingsScope-compatible adapter over the plugin's own settings route. */
function createRouteScope(route) {
  let snapshot = {
    status: 'loading',
    writable: false,
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    mode: 'host',
  };
  const listeners = new Set();
  function notify() {
    for (const listener of listeners) listener();
  }
  function accept(value) {
    snapshot = {
      status: 'ready',
      writable: value.writable === true,
      value: value.settings?.value ?? {},
      base: value.settings?.base ?? {},
      user: value.settings?.user ?? {},
      revision: value.settings?.revision,
      mode: 'host',
    };
    notify();
  }
  async function load() {
    try {
      accept(await route(undefined));
    } catch (err) {
      snapshot = { ...snapshot, status: 'unavailable' };
      notify();
    }
  }
  async function mutate(ops) {
    const revision = snapshot.revision;
    try {
      accept(await route({
        action: 'mutate',
        ops,
        ...(revision === undefined ? {} : { expectedRevision: revision }),
      }));
    } catch (err) {
      await load();
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (field, value) => mutate([{ op: 'set', path: [field], value }]),
    unset: (field) => mutate([{ op: 'unset', path: [field] }]),
    load,
  };
}

/* Official plugin-card chrome + staged-field styles (same tokens/values as the
 * shipped dsh-client-ui-settings-plugins cards; prefixed to stay collision-free). */
const CSS = '.pcb-field{flex-direction:column;gap:6px;padding:12px 0;display:flex}' +
  '.pcb-field+.pcb-field{border-top:1px solid var(--dsw-alias-border-l2)}' +
  '.pcb-head{align-items:center;gap:8px;display:flex}' +
  '.pcb-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}' +
  '.pcb-badges{align-items:center;gap:8px;display:inline-flex}' +
  '.pcb-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}' +
  '.pcb-badgeMuted{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}' +
  '.pcb-reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}' +
  '.pcb-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}' +
  '.pcb-reset:disabled{cursor:default}' +
  '.pcb-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}' +
  '.pcb-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}' +
  '.pcb-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}' +
  '.pcb-inputInvalid{border-color:var(--dsw-alias-label-error)}' +
  '.pcb-check{display:flex;align-items:center;height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:8px;padding:0 12px}' +
  '.pcb-check input{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}' +
  '.pcb-check input:disabled{cursor:default}' +
  '.pcb-invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}' +
  '.pcb-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}' +
  '.pcb-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}' +
  '.pcb-card:hover{border-color:var(--dsw-alias-label-dimmed)}' +
  '.pcb-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}' +
  '.pcb-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}' +
  '.pcb-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}' +
  '.pcb-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}' +
  '.pcb-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
  '.pcb-description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}' +
  '.pcb-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}' +
  '.pcb-chevronOpen{transform:rotate(180deg)}' +
  '.pcb-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}' +
  '.pcb-readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}' +
  '.pcb-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}' +
  '.pcb-footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}' +
  '.pcb-failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}' +
  '.pcb-discard,.pcb-save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}' +
  '.pcb-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}' +
  '.pcb-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}' +
  '.pcb-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}' +
  '.pcb-discard:disabled,.pcb-save:disabled{opacity:.4;cursor:default}' +
  '.pcb-discard:focus-visible,.pcb-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}';

function installStyles() {
  const style = document.createElement('style');
  style.dataset.pluginCss = 'dsh-bg-tool';
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => { style.remove(); };
}

/* ---- staged-field specs (official card-form semantics) ---- */

/** A free-text field: an empty draft clears the field. */
function textField(field) {
  return {
    field,
    format: (value) => typeof value === 'string' ? value : '',
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed };
    },
  };
}

/** A single-choice field restricted to `options`; an empty draft clears it. */
function enumField(field, options) {
  const allowed = new Set(options);
  return {
    field,
    format: (value) => typeof value === 'string' ? value : '',
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === '') return { kind: 'clear' };
      return allowed.has(trimmed) ? { kind: 'set', value: trimmed } : undefined;
    },
  };
}

/** A boolean field; only 'true'/'false' drafts are accepted. */
function boolField(field) {
  return {
    field,
    format: (value) => value === true ? 'true' : value === false ? 'false' : '',
    parse: (text) => {
      if (text === 'true') return { kind: 'set', value: true };
      if (text === 'false') return { kind: 'set', value: false };
      return undefined;
    },
  };
}

/* ---- staged form model (mirror of the official CardForm) ---- */

/**
 * Stages one card's edits over one settings namespace and writes them on save.
 * Writes go through the bound scope, so each is a durable, revision-fenced
 * document mutation; the outcome is read back from the scope rather than
 * predicted. A save that did not land keeps its drafts.
 */
function createForm(scope, specs) {
  const specMap = new Map(specs.map((spec) => [spec.field, spec]));
  const staged = new Map();
  const listeners = new Set();
  let saving = false;
  let failed = false;

  const snapshotOf = () => scope.getSnapshot();
  const sectionValue = (field) => snapshotOf().value?.[field];
  const baseValue = (field) => snapshotOf().base?.[field];
  const userLayer = () => snapshotOf().user;
  const stored = (field) => {
    const user = userLayer();
    return user !== undefined && Object.hasOwn(user, field);
  };
  const specOf = (field) => {
    const spec = specMap.get(field);
    if (spec === undefined) throw new Error('plugin card has no field ' + field);
    return spec;
  };

  function publish() {
    for (const listener of listeners) listener();
  }

  /** Every staged edit a save would write, in staging order. */
  function plan() {
    const plan = [];
    for (const [field, edit] of staged) {
      const spec = specOf(field);
      if (edit.clear) {
        if (stored(field)) plan.push({ field, run: () => clearField(field) });
        continue;
      }
      if (edit.text === spec.format(sectionValue(field))) continue;
      const write = spec.parse(edit.text);
      if (write === undefined) plan.push({ field, run: undefined });
      else if (write.kind === 'clear') plan.push({ field, run: () => clearField(field) });
      else plan.push({ field, run: () => storeField(field, write.value) });
    }
    return plan;
  }

  function shell() {
    const snapshot = snapshotOf();
    const planned = plan();
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: planned.length > 0,
      invalid: planned.some((item) => item.run === undefined),
      saving,
      failed,
    };
  }

  function field(field) {
    const edit = staged.get(field);
    const spec = specOf(field);
    if (edit === undefined) {
      return { text: spec.format(sectionValue(field)), overridden: stored(field), invalid: false };
    }
    const write = edit.clear ? { kind: 'clear' } : spec.parse(edit.text);
    return {
      text: edit.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    };
  }

  function stage(field, edit) {
    staged.set(field, edit);
    failed = false;
    publish();
  }

  async function clearField(field) {
    await scope.unset(field);
    return !stored(field);
  }

  async function storeField(field, value) {
    await scope.set(field, value);
    return userLayer()?.[field] === value;
  }

  async function save() {
    const planned = plan();
    const writes = planned.flatMap((item) => item.run === undefined ? [] : [item.run]);
    if (planned.length === 0 || saving || writes.length !== planned.length) return;
    saving = true;
    failed = false;
    publish();
    let landed = true;
    for (const write of writes) landed = await write() && landed;
    if (landed) staged.clear();
    saving = false;
    failed = !landed;
    publish();
  }

  scope.subscribe(() => publish());

  return {
    shell,
    field,
    actions: () => ({
      edit: (field, text) => stage(field, { text, clear: false }),
      resetField: (field) => stage(field, { text: specOf(field).format(baseValue(field)), clear: true }),
      save,
      discard: () => {
        if (staged.size === 0 && !failed) return;
        staged.clear();
        failed = false;
        publish();
      },
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/* ---- official card chrome ---- */

/* The official dsh chevron-down icon (ic_ds_chevron_down_outline_14), inlined
 * so the card header renders pixel-identically to the shipped plugin cards. */
function ChevronDown(props) {
  return React.createElement('svg', {
    width: 14,
    height: 14,
    className: props.className,
    viewBox: '0 0 14 14',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }, React.createElement('path', {
    d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z',
    fill: 'currentColor',
  }));
}

function PluginCard(props) {
  const [open, setOpen] = React.useState(false);
  const { state } = props;
  if (!state.available) return null;
  const blocked = !state.dirty || state.invalid || state.saving;
  return React.createElement('li', { className: 'pcb-card' + (open ? ' pcb-cardOpen' : '') },
    React.createElement('button', {
      type: 'button',
      className: 'pcb-header',
      'aria-expanded': open,
      'aria-label': (open ? '收起设置' : '展开设置') + '：' + props.title,
      onClick: () => setOpen(!open),
    },
      React.createElement('span', { className: 'pcb-headText' },
        React.createElement('span', { className: 'pcb-name' }, props.title),
        React.createElement('span', { className: 'pcb-description' }, props.description)),
      state.dirty ? React.createElement('span', { className: 'pcb-pending' }, '未保存') : null,
      React.createElement(ChevronDown, { className: 'pcb-chevron' + (open ? ' pcb-chevronOpen' : '') })),
    open ? React.createElement('div', { className: 'pcb-body' },
      !state.writable ? React.createElement('p', { className: 'pcb-readOnly', role: 'status' }, '本部署的设置为只读。') : null,
      props.children,
      React.createElement('div', { className: 'pcb-footer' },
        state.failed ? React.createElement('p', { className: 'pcb-failed', role: 'status' }, '本部署没有接受这些值，已保留供你修改。') : null,
        React.createElement('button', { type: 'button', className: 'pcb-discard', disabled: !state.dirty || state.saving, onClick: props.onDiscard }, '放弃修改'),
        React.createElement('button', { type: 'button', className: 'pcb-save', disabled: blocked, onClick: props.onSave }, state.saving ? '保存中…' : '保存'))) : null);
}

/** A staged text field with the override badge and reset (official fields style). */
function ValueField(props) {
  return React.createElement('div', { className: 'pcb-field' },
    React.createElement('div', { className: 'pcb-head' },
      React.createElement('label', { className: 'pcb-label', htmlFor: props.id }, props.label),
      props.overridden ? React.createElement('span', { className: 'pcb-badges' },
        React.createElement('span', { className: 'pcb-badge' }, props.overriddenLabel),
        React.createElement('button', { type: 'button', className: 'pcb-reset', disabled: props.disabled, onClick: props.onReset }, props.resetLabel)) : null),
    React.createElement('input', {
      id: props.id,
      className: props.invalid ? 'pcb-input pcb-inputInvalid' : 'pcb-input',
      type: 'text',
      ...(props.invalid ? { 'aria-invalid': true } : {}),
      value: props.text,
      placeholder: props.placeholder ?? '',
      disabled: props.disabled,
      onChange: (event) => props.onEdit(event.target.value),
    }),
    React.createElement('p', { className: props.invalid ? 'pcb-invalid' : 'pcb-hint' },
      props.invalid ? props.invalidLabel : props.hint));
}

/** A staged single-choice control over `options`. */
function SelectField(props) {
  return React.createElement('div', { className: 'pcb-field' },
    React.createElement('div', { className: 'pcb-head' },
      React.createElement('label', { className: 'pcb-label', htmlFor: props.id }, props.label),
      props.overridden ? React.createElement('span', { className: 'pcb-badges' },
        React.createElement('span', { className: 'pcb-badge' }, props.overriddenLabel),
        React.createElement('button', { type: 'button', className: 'pcb-reset', disabled: props.disabled, onClick: props.onReset }, props.resetLabel)) : null),
    React.createElement('select', {
      id: props.id,
      className: props.invalid ? 'pcb-input pcb-inputInvalid' : 'pcb-input',
      ...(props.invalid ? { 'aria-invalid': true } : {}),
      value: props.text,
      disabled: props.disabled,
      onChange: (event) => props.onEdit(event.target.value),
    }, props.options.map((option) => React.createElement('option', { key: option, value: option }, option))),
    React.createElement('p', { className: props.invalid ? 'pcb-invalid' : 'pcb-hint' },
      props.invalid ? props.invalidLabel : props.hint));
}

/** A staged boolean control rendered as a checkbox. */
function CheckField(props) {
  return React.createElement('div', { className: 'pcb-field' },
    React.createElement('div', { className: 'pcb-head' },
      React.createElement('label', { className: 'pcb-label', htmlFor: props.id }, props.label),
      props.overridden ? React.createElement('span', { className: 'pcb-badges' },
        React.createElement('span', { className: 'pcb-badge' }, props.overriddenLabel),
        React.createElement('button', { type: 'button', className: 'pcb-reset', disabled: props.disabled, onClick: props.onReset }, props.resetLabel)) : null),
    React.createElement('div', { className: 'pcb-check' },
      React.createElement('input', {
        id: props.id,
        type: 'checkbox',
        checked: props.text === 'true',
        disabled: props.disabled,
        onChange: (event) => props.onEdit(event.target.checked ? 'true' : 'false'),
      })),
    React.createElement('p', { className: 'pcb-hint' }, props.hint));
}

/* ---- card controller over the `bg-tool` namespace ---- */

function BgCardController(ctx) {
  const scope = createRouteScope((payload) => requestRoute(payload));
  const form = createForm(scope, [
    enumField('generalModel', MODELS),
    enumField('portraitModel', MODELS),
    enumField('fastModel', MODELS),
    textField('outputDir'),
    boolField('autoStartServer'),
  ]);
  const actions = form.actions();
  const listeners = new Set();
  let state = null;

  function publish() {
    state = project();
    for (const listener of listeners) listener();
  }

  function project() {
    return {
      ...form.shell(),
      generalModel: form.field('generalModel'),
      portraitModel: form.field('portraitModel'),
      fastModel: form.field('fastModel'),
      outputDir: form.field('outputDir'),
      autoStartServer: form.field('autoStartServer'),
    };
  }

  form.subscribe(publish);
  publish();
  void scope.load();

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => state,
    refresh: () => { void scope.load(); },
    edit: actions.edit,
    resetField: actions.resetField,
    save: actions.save,
    discard: actions.discard,
  };
}

function BgCard(props) {
  const controller = props.controller;
  const state = React.useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const disabled = !state.writable;
  const select = (key, label, hint) => React.createElement(SelectField, {
    id: 'plugin-config-bg-' + key,
    label,
    hint,
    options: MODELS,
    overriddenLabel: '已覆盖',
    resetLabel: '恢复默认',
    invalidLabel: '请选择有效模型，或留空使用默认值。',
    disabled,
    ...state[key],
    onEdit: (text) => controller.edit(key, text),
    onReset: () => controller.resetField(key),
  });
  return React.createElement(PluginCard, {
    title: '背景抠图',
    description: '本地 rembg GPU 抠图服务：模型、输出目录与自动启动。',
    state,
    onSave: controller.save,
    onDiscard: controller.discard,
  },
    select('generalModel', '通用模型 (general)', 'general 模式使用的分割模型。'),
    select('portraitModel', '人像模型 (portrait)', 'portrait 模式使用的分割模型。'),
    select('fastModel', '快速模型 (fast)', 'fast 模式使用的快速模型。'),
    React.createElement(ValueField, {
      id: 'plugin-config-bg-outputDir',
      label: '输出目录 (outputDir)',
      hint: '抠图结果 PNG 的输出目录。',
      overriddenLabel: '已覆盖',
      resetLabel: '恢复默认',
      invalidLabel: '请输入有效值，或留空使用默认值。',
      disabled,
      ...state.outputDir,
      onEdit: (text) => controller.edit('outputDir', text),
      onReset: () => controller.resetField('outputDir'),
    }),
    React.createElement(CheckField, {
      id: 'plugin-config-bg-autoStartServer',
      label: '自动启动 GPU 服务 (autoStartServer)',
      hint: '开启后，首次调用会自动启动本地 rembg GPU 服务。',
      overriddenLabel: '已覆盖',
      resetLabel: '恢复默认',
      disabled,
      ...state.autoStartServer,
      onEdit: (text) => controller.edit('autoStartServer', text),
      onReset: () => controller.resetField('autoStartServer'),
    }));
}

exports.apply = function(ctx) {
  ctx.effect(installStyles, 'dsh-bg-tool: styles');
  const controller = new BgCardController(ctx);
  const remote = ctx.get('remote');
  if (remote !== undefined && typeof remote.$on === 'function') {
    ctx.effect(() => remote.$on('settings/document-updated', (namespace) => {
      if (namespace === undefined || String(namespace) === 'bg-tool') controller.refresh();
    }), 'dsh-bg-tool: settings invalidations');
  }
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'bg-tool',
    id: 'bg-tool',
    order: 40,
    inject: () => ({ controller }),
  }, BgCard));
};
};
function __resolve(from, request) {
  if (!request.startsWith(".")) return request;
  var parts = from.slice(2).split("/"); parts.pop();
  for (var part of request.split("/")) { if (part === "." || part === "") continue; if (part === "..") parts.pop(); else parts.push(part); }
  return "./" + parts.join("/");
}
function __load(id) {
  if (__modules[id] === undefined) return require(id);
  if (__cache[id] !== undefined) return __cache[id].exports;
  var module = __cache[id] = { exports: {} };
  __modules[id](module, module.exports, require, function(request) { var resolved = __resolve(id, request); return __modules[resolved] === undefined ? require(request) : __load(resolved); });
  return module.exports;
}
return __load("./index.js"); } });
