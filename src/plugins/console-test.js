import { ui } from '../runtime.js';

const LIMIT = 2000;

export function preview(value) {
    if (typeof value === 'string') return value.slice(0, LIMIT);
    if (typeof value === 'undefined') return 'undefined';
    const seen = new Set();
    try {
        const text = JSON.stringify(value, (_key, item) => {
            if (typeof item === 'bigint') return String(item);
            if (typeof item === 'function') return `[Function ${item.name || 'anonymous'}]`;
            if (item && typeof item === 'object') {
                if (seen.has(item)) return '[Circular]';
                seen.add(item);
            }
            return item;
        }, 2);
        return (text ?? String(value)).slice(0, LIMIT);
    } catch {
        return String(value).slice(0, LIMIT);
    }
}

export function probe(host = globalThis) {
    const lines = [];
    lines.push(`eval: ${typeof host.eval}`);
    lines.push(`Function: ${typeof host.Function}`);
    lines.push(`HermesInternal: ${host.HermesInternal ? 'present' : 'absent'}`);
    lines.push(`console.log: ${typeof host.console?.log}`);
    let evalResult = 'not run';
    try {
        if (typeof host.eval === 'function') evalResult = String((0, host.eval)('40+2'));
    } catch (error) {
        evalResult = `error: ${error.message}`;
    }
    lines.push(`eval 40+2: ${evalResult}`);
    let functionResult = 'not run';
    try {
        if (typeof host.Function === 'function') functionResult = String(host.Function('return 40+2')());
    } catch (error) {
        functionResult = `error: ${error.message}`;
    }
    lines.push(`Function 40+2: ${functionResult}`);
    const ran = evalResult === '42' || functionResult === '42';
    lines.push(ran ? 'JavaScript ran in this Discord runtime.' : 'JavaScript did not run in this Discord runtime.');
    return { lines, ran };
}

export function hostNotes(r) {
    const modules = r?.RN?.NativeModules || {};
    const names = Object.keys(modules).filter(name => /console|hermes|devmenu|devsettings|debugger|inspector/i.test(name));
    const notes = [names.length ? `Native modules: ${names.join(', ')}` : 'Native modules: no console, Hermes, DevMenu, or inspector name'];
    for (const name of ['DevMenu', 'Debugger', 'Console']) {
        let found = false;
        try { found = !!r?.byName?.(name); } catch { found = false; }
        notes.push(`${name}: ${found ? 'found' : 'not found'}`);
    }
    return notes;
}

export function execute(code, host = globalThis) {
    const source = String(code ?? '');
    if (!source.trim()) throw new Error('Enter JavaScript to run');
    if (source.length > LIMIT) throw new Error(`Limit is ${LIMIT} characters`);
    if (typeof host.eval !== 'function') throw new Error('eval is not available in this runtime');
    return (0, host.eval)(source);
}

export default function ConsoleTest(r) {
    const { h, React } = r;
    const { Page, Text, Button, Input } = ui(r);
    function Settings() {
        r.useRefresh();
        const [code, setCode] = React.useState('1 + 1');
        const [report, setReport] = React.useState('Press Probe or Run. Nothing runs until you do.');
        function show(lines) {
            const text = lines.join('\n');
            setReport(text);
            try { console.log(`[ConsoleTest]\n${text}`); } catch { /* The probe still shows the result on this page. */ }
        }
        return h(Page, { title: 'Console test' },
            h(Text, { muted: true }, 'Checks whether Snow can run JavaScript in this Discord app. Probe tests the runtime. Run executes the snippet and prints the result with console.log.'),
            h(Button, { text: 'Probe runtime', variant: 'secondary', onPress: () => show([...probe().lines, ...hostNotes(r)]) }),
            h(Input, {
                label: 'JavaScript',
                value: code,
                onChange: setCode,
                placeholder: '1 + 1',
                multiline: true,
                maxLength: LIMIT,
                style: { minHeight: 120, textAlignVertical: 'top' },
            }),
            h(Button, { text: 'Run snippet', onPress: () => {
                try { show([`Result: ${preview(execute(code))}`]); }
                catch (error) { show([`Error: ${error.message || error}`]); }
            } }),
            h(Text, { selectable: true }, report));
    }
    return {
        start() {
            r.command({
                name: 'consoletest',
                description: 'Open the Discord console execution test',
                execute() { r.open('console', Settings); },
            });
        },
        Settings,
    };
}
