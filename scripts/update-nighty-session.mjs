import { readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REF !== 'refs/heads/dev') throw new Error('Dev only');
const baseline = '0f47e0b9ed625e0dbe8ac3696ee82256d577c064';
const files = ['src/plugins/nighty-tab.js', 'src/registry.json', 'NightyTab/index.js', 'NightyTab/manifest.json'];
const original = name => execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const host = `function pageHost() {
        try {
            const url = new URL(String(store.url).trim());
            return url.protocol === 'https:' && !url.username && !url.password && !/(^|\\.)discord(?:app)?\\.(?:com|net)$/i.test(url.hostname) ? url.origin : '';
        } catch { return ''; }
    }`;
const boot = "function(config) {\n    if (!config.origin || window.top !== window.self || location.origin !== config.origin || window.__mimeNightyCookieV3) return true;\n    window.__mimeNightyCookieV3 = true;\n    const valid = value => typeof value === 'string' && value.length >= 8 && value.length <= 4096 && /^[\\w.~+/-]+=*$/.test(value) ? value : '';\n    let blocked = false, last = '', lastLocal = '', lastCookie = '', revision = 0, timer;\n    try { blocked = sessionStorage.getItem('__mimeNightyLogout') === '1'; } catch {}\n    const emit = (token = '', logout = false) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'NIGHTY_TOKEN', origin: config.origin, token, logout }));\n    const local = () => { try { return valid(localStorage.getItem('access_token')); } catch { return ''; } };\n    const cookie = () => { try { const value = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith('access_token=')); return value ? valid(decodeURIComponent(value.slice(13))) : ''; } catch { return ''; } };\n    const setCookie = value => { try { document.cookie = 'access_token=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + (value ? '2592000' : '0') + '; SameSite=Lax; Secure'; } catch {} };\n    const clear = (erase = true) => {\n        blocked = true; last = ''; revision += 1;\n        try { sessionStorage.setItem('__mimeNightyLogout', '1'); } catch {}\n        if (erase) { try { localStorage.removeItem('access_token'); } catch {} setCookie(''); }\n        emit('', true);\n    };\n    const save = value => {\n        value = valid(value);\n        if (!value) return;\n        blocked = false; revision += 1;\n        try { sessionStorage.removeItem('__mimeNightyLogout'); } catch {}\n        try { if (local() !== value) localStorage.setItem('access_token', value); } catch {}\n        if (cookie() !== value) setCookie(value);\n        lastLocal = local(); lastCookie = cookie();\n        if (last !== value) { last = value; emit(value); }\n    };\n    if (blocked) clear();\n    else save(local() || cookie() || valid(config.token));\n    try {\n        const proto = Object.getPrototypeOf(localStorage), set = proto.setItem, remove = proto.removeItem, empty = proto.clear;\n        proto.setItem = function(key, value) { const result = set.apply(this, arguments); if (this === localStorage && String(key) === 'access_token') { if (valid(String(value))) save(String(value)); else clear(); } return result; };\n        proto.removeItem = function(key) { const result = remove.apply(this, arguments); if (this === localStorage && String(key) === 'access_token' && !blocked) clear(); return result; };\n        proto.clear = function() { const result = empty.apply(this, arguments); if (this === localStorage && !blocked) clear(); return result; };\n    } catch {}\n    const poll = () => {\n        if (blocked || location.origin !== config.origin) return;\n        const l = local(), c = cookie();\n        if ((lastLocal && !l) || (lastCookie && !c)) { clear(); return; }\n        const next = l && l !== lastLocal ? l : c && c !== lastCookie ? c : l || c;\n        lastLocal = l; lastCookie = c;\n        if (next && next !== last) save(next);\n    };\n    const endpoint = value => { try { const url = new URL(typeof value === 'string' ? value : value?.url || '', location.href); return url.origin === config.origin ? url.pathname : ''; } catch { return ''; } };\n    const logout = value => /\\/(?:logout|log-out|signout|sign-out)(?:\\/|$)/i.test(value);\n    const login = value => /\\/(?:login|log-in|signin|sign-in)(?:\\/|$)/i.test(value);\n    const receive = (path, data, started) => { if (revision === started && (!blocked || login(path))) save(data?.access_token); };\n    if (typeof window.fetch === 'function') {\n        const original = window.fetch;\n        window.fetch = function(input) {\n            const path = endpoint(input); if (logout(path)) clear(false); const started = revision;\n            return original.apply(this, arguments).then(response => {\n                if (logout(path)) clear();\n                else if (path && response.ok && response.clone && (!response.url || endpoint(response.url))) response.clone().json().then(data => receive(path, data, started)).catch(() => {});\n                return response;\n            }, error => { if (logout(path)) clear(); throw error; });\n        };\n    }\n    if (window.XMLHttpRequest?.prototype) {\n        const proto = window.XMLHttpRequest.prototype, open = proto.open, send = proto.send, paths = new WeakMap();\n        proto.open = function(method, url) { paths.set(this, endpoint(url)); return open.apply(this, arguments); };\n        proto.send = function() {\n            const path = paths.get(this) || ''; if (logout(path)) clear(false); const started = revision;\n            if (logout(path)) this.addEventListener('loadend', () => clear(), { once: true });\n            else if (path) this.addEventListener('load', () => { if (this.status >= 200 && this.status < 300 && (!this.responseURL || endpoint(this.responseURL))) { try { receive(path, this.responseType === 'json' ? this.response : JSON.parse(this.responseText), started); } catch {} } }, { once: true });\n            return send.apply(this, arguments);\n        };\n    }\n    window.addEventListener('storage', event => { if (event.storageArea === localStorage && (event.key === null || event.key === 'access_token')) { if (!valid(event.newValue)) clear(); else save(event.newValue); } });\n    document.addEventListener('click', event => { const link = event.target?.closest?.('a[href]'); if (link && logout(endpoint(link.href))) clear(false); }, true);\n    document.addEventListener('submit', event => { if (logout(endpoint(event.target?.action))) clear(false); }, true);\n    const start = () => { if (!timer) timer = setInterval(poll, 1000); };\n    window.addEventListener('pagehide', () => { poll(); clearInterval(timer); timer = undefined; });\n    window.addEventListener('pageshow', start); start(); return true;\n}";
const inject = `function sessionScript(token) {
        return '(' + ${JSON.stringify(boot)} + ')(' + JSON.stringify({ origin: pageHost(), token: cleanToken(token) }) + ');true;';
    }`;
const message = `function onSessionMessage(event) {
        if (!r.active) return;
        const origin = pageHost();
        if (!origin) return;
        const native = event?.nativeEvent;
        try { if (new URL(native?.url).origin !== origin) return; } catch { return; }
        if (typeof native?.data !== 'string' || native.data.length > 8192) return;
        let data;
        try { data = JSON.parse(native.data); } catch { return; }
        if (data?.type !== 'NIGHTY_TOKEN' || data.origin !== origin) return;
        const token = cleanToken(data.token);
        if (!data.logout && !token) return;
        const current = store.sessions && typeof store.sessions === 'object' ? { ...store.sessions } : {};
        delete current[new URL(origin).host];
        if (data.logout) delete current[origin];
        else current[origin] = token;
        r.set('sessions', current);
    }`;
function patch(input) {
    let output = input;
    for (const [name, body] of [['pageHost', host], ['sessionScript', inject], ['onSessionMessage', message]]) {
        const pattern = new RegExp('^([ \\t]*)function ' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\1\\}', 'gm');
        const matches = [...output.matchAll(pattern)];
        if (matches.length !== 1) throw new Error(`Expected exactly one ${name}; refusing to alter unknown bundle`);
        const match = matches[0];
        output = output.slice(0, match.index) + match[1] + body + output.slice(match.index + match[0].length);
    }
    const cookieHeader = /headers:\s*\{\s*Cookie:\s*`access_token=\$\{sessionToken\(\)\}`\s*\}/g;
    output = output.replace(cookieHeader, 'headers: {}');
    if (/Cookie:[^\n]*access_token/.test(output)) throw new Error('Unknown credential header; refusing unsafe restoration');
    return output;
}
const prepared = new Map();
for (const name of files) {
    const text = original(name);
    prepared.set(name, name.endsWith('.js') ? patch(text) : text);
}
for (const [name, text] of prepared) await writeFile(path.join(root, name), text);
await rm(path.join(root, 'src/plugins/nighty-session.js'), { force: true });
