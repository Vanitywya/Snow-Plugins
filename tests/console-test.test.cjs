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

test('Console Test level filters hide warns and info but keep the prompt result', async () => {
    const { visibleEntries } = await import('../src/plugins/console-test.js');
    const entries = [
        { level: 'log', text: 'hello' },
        { level: 'warn', text: 'careful' },
        { level: 'info', text: 'note' },
        { level: 'error', text: 'boom' },
        { level: 'command', text: '1+1' },
        { level: 'result', text: '2' },
    ];
    const shown = visibleEntries(entries, { log: true, info: false, warn: false, error: true, debug: true }, '');
    assert.deepEqual(shown.map(entry => entry.level), ['log', 'error', 'command', 'result']);
    assert.deepEqual(visibleEntries(entries, { log: true, info: true, warn: true, error: true, debug: true }, 'care').map(entry => entry.text), ['careful']);
});
