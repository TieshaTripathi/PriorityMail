const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/services/gmailDeepLink.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function setup(os, nativeFails = false, webFails = false) {
  const calls = [];
  const exports = {};
  const modules = {
    'react-native': { Platform: { OS: os } },
    'expo-linking': { openURL: async url => { calls.push(['web', url]); if (webFails) throw Error(); } },
    'expo-intent-launcher': { startActivityAsync: async (action, options) => {
      calls.push(['native', action, options]); if (nativeFails) throw Error();
    } },
  };
  vm.runInNewContext(js, { exports, require: id => modules[id] });
  return { ...exports, calls };
}

(async () => {
  const target = { accountEmail: 'work+test@gmail.com', threadId: 'a/#?&' };
  const android = setup('android');
  assert.equal(await android.openEmailInGmail(target), true);
  assert.equal(android.calls.length, 1);
  assert.equal(android.calls[0][2].packageName, 'com.google.android.gm');
  assert.equal(android.calls[0][2].data, 'https://mail.google.com/mail/u/?authuser=work%2Btest%40gmail.com#inbox/a%2F%23%3F%26');
  const fallback = setup('android', true);
  assert.equal(await fallback.openEmailInGmail(target), true);
  assert.deepEqual(fallback.calls.map(c => c[0]), ['native', 'web']);
  const ios = setup('ios');
  assert.equal(await ios.openEmailInGmail(target), true);
  assert.deepEqual(ios.calls.map(c => c[0]), ['web']);
  assert.match(ios.gmailWebUrl({ accountEmail: 'college@gmail.com', messageId: 'm1' }), /#inbox\/m1$/);
  assert.match(ios.gmailWebUrl({ accountEmail: 'personal@gmail.com' }), /#inbox$/);
  assert.equal(await setup('android', true, true).openEmailInGmail(target), false);
  assert.equal(await ios.openEmailInGmail({ accountEmail: '' }), false);
  console.log('Gmail routing: native, fallback, iOS, encoding, missing IDs and failure checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
