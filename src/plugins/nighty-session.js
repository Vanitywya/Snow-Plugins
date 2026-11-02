export function nightyOrigin(value) {
    try {
        const url = new URL(String(value).trim());
        if (url.protocol !== 'https:' || url.username || url.password || /(^|\.)discord(?:app)?\.(?:com|net)$/i.test(url.hostname)) return '';
        return url.origin;
    } catch { return ''; }
}
export function cleanNightyToken(value) {
    return typeof value === 'string' && value.length >= 8 && value.length <= 4096 && /^[\w.~+/-]+=*$/.test(value) ? value : '';
}
export function nightyBootstrap(config) {
    if (window.top !== window.self || location.origin !== config.origin || window.__mimeNightySessionV2) return true;
    window.__mimeNightySessionV2 = true;
    const valid = value => typeof value === 'string' && value.length >= 8 && value.length <= 4096 && /^[\w.~+/-]+=*$/.test(value) ? value : '';
    let last = '', blocked = !!config.loggedOut, revision = 0, timer;
    try { blocked ||= sessionStorage.getItem('__mimeNightyLoggedOut') === '1'; } catch {}
    const emit = (type, token = '') => {
        if (location.origin === config.origin) window.ReactNativeWebView?.postMessage(JSON.stringify({ type, origin: config.origin, channel: config.channel, token }));
    };
    const readLocal = () => { try { return valid(localStorage.getItem('access_token')); } catch { return ''; } };
    const readCookie = () => {
        try {
            const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('access_token='));
            return entry ? valid(decodeURIComponent(entry.slice(13))) : '';
        } catch { return ''; }
    };
    const publish = token => {
        token = valid(token);
        if (!token || blocked || token === last) return;
        last = token;
        emit('NIGHTY_SESSION_SAVE', token);
    };
    const clear = (erase = true) => {
        blocked = true;
        revision += 1;
        last = '';
        try { sessionStorage.setItem('__mimeNightyLoggedOut', '1'); } catch {}
        if (erase) {
            try { localStorage.removeItem('access_token'); } catch {}
            try { document.cookie = 'access_token=; Path=/; Max-Age=0; SameSite=Lax; Secure'; } catch {}
        }
        emit('NIGHTY_SESSION_CLEAR');
    };
    const accept = token => {
        token = valid(token);
        if (!token) return;
        blocked = false;
        revision += 1;
        try { sessionStorage.removeItem('__mimeNightyLoggedOut'); } catch {}
        try { localStorage.setItem('access_token', token); } catch {}
        publish(token);
    };
    if (blocked) {
        try { localStorage.removeItem('access_token'); } catch {}
        try { document.cookie = 'access_token=; Path=/; Max-Age=0; SameSite=Lax; Secure'; } catch {}
    }
    if (!blocked && !readLocal() && !readCookie() && valid(config.token)) {
        try { localStorage.setItem('access_token', config.token); } catch {}
        try { document.cookie = 'access_token=' + encodeURIComponent(config.token) + '; Path=/; Max-Age=2592000; SameSite=Lax; Secure'; } catch {}
    }
    last = readLocal() || readCookie();
    if (last && !blocked) emit('NIGHTY_SESSION_SAVE', last);
    const poll = () => {
        if (blocked || location.origin !== config.origin) return;
        const token = readLocal() || readCookie();
        if (token) publish(token);
        else if (last) clear();
    };
    try {
        const proto = Object.getPrototypeOf(localStorage);
        const set = proto.setItem, remove = proto.removeItem, empty = proto.clear;
        proto.setItem = function(key, value) {
            const result = set.apply(this, arguments);
            if (this === localStorage && String(key) === 'access_token') {
                if (valid(String(value))) {
                    blocked = false;
                    revision += 1;
                    try { sessionStorage.removeItem('__mimeNightyLoggedOut'); } catch {}
                    publish(String(value));
                } else clear();
            }
            return result;
        };
        proto.removeItem = function(key) {
            const result = remove.apply(this, arguments);
            if (this === localStorage && String(key) === 'access_token' && !blocked) clear();
            return result;
        };
        proto.clear = function() {
            const result = empty.apply(this, arguments);
            if (this === localStorage && !blocked) clear();
            return result;
        };
    } catch {}
    const endpoint = value => {
        try {
            const url = new URL(typeof value === 'string' ? value : value?.url || '', location.href);
            return url.origin === config.origin ? url.pathname : '';
        } catch { return ''; }
    };
    const logoutPath = path => /\/(?:logout|log-out|signout|sign-out)(?:\/|$)/i.test(path);
    const loginPath = path => /\/(?:login|log-in|signin|sign-in)(?:\/|$)/i.test(path);
    const responseToken = (path, data, started) => {
        if (revision !== started || (blocked && !loginPath(path))) return;
        accept(data?.access_token);
    };
    if (typeof window.fetch === 'function') {
        const original = window.fetch;
        window.fetch = function(input) {
            const path = endpoint(input);
            if (logoutPath(path)) clear(false);
            const started = revision;
            return original.apply(this, arguments).then(response => {
                if (logoutPath(path)) clear();
                if (path && !logoutPath(path) && (!response.url || endpoint(response.url)) && response.ok && response.clone) response.clone().json().then(data => responseToken(path, data, started)).catch(() => {});
                return response;
            }, error => { if (logoutPath(path)) clear(); throw error; });
        };
    }
    if (window.XMLHttpRequest?.prototype) {
        const proto = window.XMLHttpRequest.prototype;
        const open = proto.open, send = proto.send, paths = new WeakMap();
        proto.open = function(method, url) { paths.set(this, endpoint(url)); return open.apply(this, arguments); };
        proto.send = function() {
            const path = paths.get(this) || '';
            if (logoutPath(path)) clear(false);
            const started = revision;
            if (logoutPath(path)) this.addEventListener('loadend', () => clear(), { once: true });
            else if (path) this.addEventListener('load', () => {
                if (this.status < 200 || this.status >= 300 || (this.responseURL && !endpoint(this.responseURL))) return;
                try { responseToken(path, this.responseType === 'json' ? this.response : JSON.parse(this.responseText), started); } catch {}
            }, { once: true });
            return send.apply(this, arguments);
        };
    }
    window.addEventListener('storage', event => {
        if (event.storageArea !== localStorage) return;
        if (event.key === null || (event.key === 'access_token' && !valid(event.newValue))) clear();
        else if (event.key === 'access_token') accept(event.newValue);
    });
    document.addEventListener('click', event => {
        const link = event.target?.closest?.('a[href]');
        if (link && logoutPath(endpoint(link.href))) clear(false);
    }, true);
    document.addEventListener('submit', event => { if (logoutPath(endpoint(event.target?.action))) clear(false); }, true);
    const start = () => { if (!timer) timer = setInterval(poll, 1000); };
    window.addEventListener('pagehide', () => { poll(); clearInterval(timer); timer = undefined; });
    window.addEventListener('pageshow', start);
    start();
    return true;
}
export function createNightySession(r, url) {
    const origin = nightyOrigin(url);
    const channel = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const records = () => r.store.nightySessionsV2 && typeof r.store.nightySessionsV2 === 'object' && !Array.isArray(r.store.nightySessionsV2) ? r.store.nightySessionsV2 : {};
    let disposed = false, pending = Promise.resolve();
    const script = () => {
        const record = records()[origin];
        const config = { origin, channel, token: cleanNightyToken(record?.token), loggedOut: record?.loggedOut === true };
        return origin ? `(${nightyBootstrap.toString()})(${JSON.stringify(config)}); true;` : 'true;';
    };
    function onMessage(event) {
        if (disposed || !r.active || !origin || nightyOrigin(r.store.url) !== origin) return;
        const native = event?.nativeEvent;
        if (nightyOrigin(native?.url) !== origin || typeof native?.data !== 'string' || native.data.length > 8192) return;
        let data;
        try { data = JSON.parse(native.data); } catch { return; }
        if (data?.origin !== origin || data.channel !== channel) return;
        const clear = data.type === 'NIGHTY_SESSION_CLEAR', token = cleanNightyToken(data.token);
        if (!clear && (data.type !== 'NIGHTY_SESSION_SAVE' || !token)) return;
        const current = records();
        if (!clear && current[origin]?.token === token) return;
        r.store.nightySessionsV2 = { ...current, [origin]: clear ? { loggedOut: true, updatedAt: Date.now() } : { token, updatedAt: Date.now() } };
        if (r.store.sessions && typeof r.store.sessions === 'object') {
            const legacy = { ...r.store.sessions };
            delete legacy[new URL(origin).host];
            r.store.sessions = legacy;
        }
        r.changed();
        pending = pending.catch(() => {}).then(() => r.api.storage.flush()).catch(() => {
            if (r.active) r.error('Nighty session', new Error('Could not persist the Nighty session. Sign in again if necessary.'));
        });
    }
    return { origin, get script() { return script(); }, onMessage, dispose() { disposed = true; return pending; } };
}
