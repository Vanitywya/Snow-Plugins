const LIMIT = 2000;
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'];
const COLORS = {
    log: '#e8eaed',
    info: '#8ab4f8',
    warn: '#fdd663',
    error: '#f28b82',
    debug: '#9aa0a6',
    command: '#8ab4f8',
    result: '#81c995',
    fatal: '#f28b82',
    reject: '#f28b82',
};

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

export function formatValue(value) {
    if (typeof value === 'string') return value;
    if (value?.stack) return String(value.stack);
    return preview(value);
}

export function redact(text) {
    return String(text)
        .replace(/(https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/)[\w-]+/gi, '$1[redacted]')
        .replace(/(authorization["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s,"'}]+/gi, '$1[redacted]')
        .replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g, '[redacted]');
}

export function visibleEntries(entries, enabled, query) {
    const needle = String(query || '').trim().toLowerCase();
    return entries.filter(entry => {
        if (needle && !entry.text.toLowerCase().includes(needle)) return false;
        if (entry.level === 'command' || entry.level === 'result') return true;
        if (entry.level === 'fatal' || entry.level === 'reject') return enabled.error !== false;
        return enabled[entry.level] !== false;
    });
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

export function execute(code, host = globalThis) {
    const source = String(code ?? '');
    if (!source.trim()) throw new Error('Enter JavaScript to run');
    if (source.length > LIMIT) throw new Error(`Limit is ${LIMIT} characters`);
    if (typeof host.eval !== 'function') throw new Error('eval is not available in this runtime');
    return (0, host.eval)(source);
}

export default function ConsoleTest(r) {
    const { h, React, RN } = r;
    let entries = [];
    let seq = 0;
    let timer;
    function stamp() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour12: false });
    }
    function notify() {
        if (timer) return;
        timer = setTimeout(() => { timer = null; if (r.active) r.changed(); }, 50);
    }
    function push(entry) {
        const text = redact(formatValue(entry.text)).slice(0, 8000);
        const last = entries[entries.length - 1];
        if (last && entry.level !== 'command' && last.level === entry.level && last.text === text) {
            last.count += 1;
            last.time = stamp();
        } else {
            entries.push({ id: ++seq, level: entry.level, text, time: stamp(), count: 1 });
            if (entries.length > 500) entries.splice(0, entries.length - 500);
        }
        notify();
    }
    function clear() { entries = []; notify(); }
    function Console({ close }) {
        r.useRefresh();
        const listRef = React.useRef(null);
        const [code, setCode] = React.useState('');
        const [query, setQuery] = React.useState('');
        const [enabled, setEnabled] = React.useState({ log: true, info: true, warn: true, error: true, debug: true });
        const visible = visibleEntries(entries, enabled, query);
        const screen = RN.Dimensions?.get?.('window')?.height || 700;
        const font = RN.Platform?.OS === 'ios' ? 'Menlo' : 'monospace';
        React.useEffect(() => { listRef.current?.scrollToEnd?.({ animated: false }); }, [visible.length, entries.length]);
        function run() {
            const source = code;
            if (!source.trim()) return;
            setCode('');
            push({ level: 'command', text: source });
            try { push({ level: 'result', text: preview(execute(source)) }); }
            catch (error) { push({ level: 'error', text: error?.stack || error?.message || String(error) }); }
        }
        function chip(level) {
            const on = enabled[level] !== false;
            const color = COLORS[level];
            return h(RN.Pressable, {
                key: level,
                accessibilityRole: 'button',
                accessibilityLabel: `${on ? 'Hide' : 'Show'} ${level}`,
                accessibilityState: { selected: on },
                onPress: () => setEnabled(current => ({ ...current, [level]: !current[level] })),
                style: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: on ? color : '#3c4043', backgroundColor: on ? '#303134' : 'transparent', opacity: on ? 1 : 0.45 },
            }, h(RN.Text, { style: { color, fontSize: 12, fontWeight: '700', textDecorationLine: on ? 'none' : 'line-through' } }, level));
        }
        function row({ item }) {
            const color = COLORS[item.level] || COLORS.log;
            const wash = item.level === 'warn' ? '#3a3000' : item.level === 'error' || item.level === 'fatal' || item.level === 'reject' ? '#3c2020' : 'transparent';
            const prefix = item.level === 'command' ? '›' : item.level === 'result' ? '←' : item.level;
            return h(RN.View, { key: String(item.id), style: { borderTopWidth: 1, borderTopColor: '#303134', borderLeftWidth: 3, borderLeftColor: color, backgroundColor: wash, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', gap: 8 } },
                h(RN.Text, { style: { color, fontFamily: font, fontSize: 11, width: 52 } }, prefix),
                h(RN.Text, { selectable: true, style: { color: item.level === 'command' ? '#e8eaed' : color, fontFamily: font, fontSize: 12, lineHeight: 16, flex: 1 } }, item.text),
                item.count > 1 ? h(RN.Text, { style: { color: '#202124', backgroundColor: color, overflow: 'hidden', borderRadius: 8, paddingHorizontal: 5, fontSize: 11, fontWeight: '700' } }, String(item.count)) : null,
                h(RN.Text, { style: { color: '#9aa0a6', fontFamily: font, fontSize: 10 } }, item.time));
        }
        return h(RN.View, { style: { height: Math.round(screen * 0.72), backgroundColor: '#202124', borderRadius: 12, overflow: 'hidden' } },
            h(RN.View, { style: { backgroundColor: '#292a2d', borderBottomWidth: 1, borderBottomColor: '#3c4043', paddingHorizontal: 10, paddingVertical: 8, gap: 8 } },
                h(RN.View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
                    h(RN.Text, { style: { color: '#e8eaed', fontSize: 13, fontWeight: '700' } }, 'Console'),
                    h(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Clear console', onPress: clear, style: { paddingHorizontal: 8, paddingVertical: 4 } },
                        h(RN.Text, { style: { color: '#9aa0a6', fontSize: 12, fontWeight: '700' } }, 'Clear'))),
                h(RN.View, { style: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } }, ...LEVELS.map(chip)),
                h(RN.TextInput, {
                    value: query,
                    onChangeText: setQuery,
                    placeholder: 'Filter',
                    placeholderTextColor: '#9aa0a6',
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    style: { minHeight: 32, color: '#e8eaed', fontSize: 13, backgroundColor: '#202124', borderRadius: 8, borderWidth: 1, borderColor: '#3c4043', paddingHorizontal: 8, paddingVertical: 4 },
                })),
            h(RN.ScrollView, {
                ref: listRef,
                style: { flex: 1 },
                contentContainerStyle: visible.length ? null : { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
                keyboardShouldPersistTaps: 'handled',
                onContentSizeChange: () => listRef.current?.scrollToEnd?.({ animated: false }),
            }, visible.length ? visible.map(item => row({ item })) : h(RN.Text, { style: { color: '#9aa0a6', fontFamily: font, fontSize: 12 } }, 'No console messages')),
            h(RN.View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#3c4043', backgroundColor: '#171717', paddingHorizontal: 10, paddingVertical: 8 } },
                h(RN.Text, { style: { color: '#8ab4f8', fontFamily: font, fontSize: 16, fontWeight: '700' } }, '›'),
                h(RN.TextInput, {
                    value: code,
                    onChangeText: setCode,
                    onSubmitEditing: run,
                    placeholder: 'JavaScript',
                    placeholderTextColor: '#6d7278',
                    autoCapitalize: 'none',
                    autoCorrect: false,
                    blurOnSubmit: false,
                    returnKeyType: 'done',
                    style: { flex: 1, minHeight: 36, color: '#e8eaed', fontFamily: font, fontSize: 13, padding: 0 },
                })),
            close ? h(RN.Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Close', onPress: close, style: { alignItems: 'center', paddingVertical: 8 } },
                h(RN.Text, { style: { color: '#9aa0a6', fontSize: 13, fontWeight: '700' } }, 'Close')) : null);
    }
    return {
        start() {
            for (const name of ['log', 'info', 'warn', 'error', 'debug']) {
                const original = console[name];
                function wrapped(...args) { push({ level: name, text: args.map(formatValue).join(' ') }); return original?.apply(console, args); }
                console[name] = wrapped;
                r.own(() => { if (console[name] === wrapped) console[name] = original; });
            }
            if (typeof console.trace === 'function') {
                const original = console.trace;
                function wrapped(...args) { push({ level: 'debug', text: args.map(formatValue).join(' ') }); return original.apply(console, args); }
                console.trace = wrapped;
                r.own(() => { if (console.trace === wrapped) console.trace = original; });
            }
            if (typeof console.clear === 'function') {
                const original = console.clear;
                function wrapped(...args) { clear(); return original.apply(console, args); }
                console.clear = wrapped;
                r.own(() => { if (console.clear === wrapped) console.clear = original; });
            }
            const errors = globalThis.ErrorUtils;
            if (errors?.getGlobalHandler && errors?.setGlobalHandler) {
                const old = errors.getGlobalHandler();
                const handler = (error, fatal) => { push({ level: fatal ? 'fatal' : 'error', text: error }); old?.(error, fatal); };
                errors.setGlobalHandler(handler);
                r.own(() => { if (errors.getGlobalHandler() === handler) errors.setGlobalHandler(old); });
            }
            if (globalThis.addEventListener && globalThis.removeEventListener) {
                const reject = event => push({ level: 'reject', text: event?.reason });
                globalThis.addEventListener('unhandledrejection', reject);
                r.own(() => globalThis.removeEventListener('unhandledrejection', reject));
            }
            r.command({ name: 'consoletest', description: 'Open the Discord console', execute() { r.open('console', Console, {}, { scrollable: false }); } });
        },
        stop() { clearTimeout(timer); entries = []; },
        Settings: Console,
        getEntries: () => entries,
    };
}
