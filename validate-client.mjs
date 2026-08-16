// Validate the __ModuleLoader__ protocol of dsh-bg-tool/lib/client.js
import fs from 'node:fs';

const ReactMock = {
  createElement: (...args) => ({ kind: 'element', args }),
  useState: () => [null, () => {}],
  useEffect: () => {},
  useSyncExternalStore: () => null,
};

const loader = { load: (payload) => { global.__payload = payload; } };
global.window = { __ModuleLoader__: loader, location: { reload: () => {} } };
global.require = (id) => {
  if (id === 'react') return ReactMock;
  throw new Error('unresolved require: ' + id);
};
const styleEl = { dataset: {}, textContent: '', remove: () => { global.__styleRemoved = true; } };
global.document = {
  createElement: () => styleEl,
  head: { appendChild: () => { global.__styleAppended = true; } },
};

const code = fs.readFileSync('E:/ProjectCode/DeepSeekHarnessWorkbook/dsh-bg-tool/lib/client.js', 'utf8');
const fn = new Function('window', 'require', code);
fn(global.window, global.require);

const payload = global.__payload;
if (!payload) { console.error('FAIL: no __ModuleLoader__.load call'); process.exit(1); }
console.log('registered id:', payload.id);

const mod = payload.factory(global.require);
console.log('factory result inject:', JSON.stringify(mod.inject), '| apply:', typeof mod.apply);

const calls = [];
const routeSnapshot = {
  writable: true,
  settings: {
    value: {
      generalModel: 'birefnet-general',
      portraitModel: 'birefnet-portrait',
      fastModel: 'u2netp',
      outputDir: 'E:/ProjectCode/DeepSeekHarnessWorkbook/.bg-tools/output',
      autoStartServer: true,
    },
    revision: 1,
    base: {},
    user: {},
  },
};
global.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, value: routeSnapshot }),
});
const mockCtx = {
  effect(fn, label) {
    calls.push('effect:' + label);
    const disposer = fn();
    calls.push('effect-disposer:' + typeof disposer);
    return disposer;
  },
  get: () => undefined,
  slots: {
    inject(name, cb) {
      calls.push('inject:' + name);
      const reg = cb();
      calls.push('register:' + JSON.stringify(reg));
    },
    register(...args) {
      calls.push('slots.register(' + args[0].name + ', id=' + args[0].id + ', order=' + args[0].order + ')');
      return () => {};
    },
  },
};
mod.apply(mockCtx);
console.log('style appended:', global.__styleAppended === true, '| style remove fn:', typeof mockCtx.effect);
console.log('apply calls:');
for (const c of calls) console.log('  ', c);
console.log('DONE');
