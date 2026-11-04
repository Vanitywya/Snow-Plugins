const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Console Test can run JavaScript and refuses an empty snippet', async () => {
    const { probe, execute, preview } = await import('../src/plugins/console-test.js');
    const report = probe(globalThis);
    assert.equal(report.ran, true);
    assert.equal(execute('1 + 2'), 3);
    assert.equal(preview({ ok: true }), '{\n  "ok": true\n}');
    assert.throws(() => execute('   '), /Enter JavaScript/);
    assert.throws(() => execute('x'.repeat(2001)), /2000 characters/);
});
