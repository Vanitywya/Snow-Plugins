// Nighty Tab mobile port. Copyright 2026 Vendicated and contributors, Mime, rico.
// SPDX-License-Identifier: GPL-3.0-or-later
import { ui } from '../runtime.js';
import { registerSection } from '../settings-section.js';
import { patchLazySheet } from '../action-sheet.js';
import { blueIcon, grayIcon } from './nighty-icon.js';

export function pageUrl(value) {
    try {
        const url = new URL(String(value).trim());
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}
export function canDownload(settings, message) {
    return !!settings.scriptUtils && typeof settings.nightyPrefix === 'string'
        && Array.from(settings.nightyPrefix).length === 1 && !!settings.nightyPrefix.trim()
        && !!message?.id && !!messageChannelId(message) && !!message.attachments?.length;
}
export function messageChannelId(message) { return message?.getChannelId?.() || message?.channel_id || message?.channelId; }

function iconHint(node) {
    const props = node?.props || {};
    const bits = [props.name, typeof props.icon === 'string' ? props.icon : ''];
    const kids = Array.isArray(props.children) ? props.children : props.children ? [props.children] : [];
    for (const child of kids) {
        if (typeof child?.props?.name === 'string') bits.push(child.props.name);
        const type = child?.type;
        if (typeof type === 'function') bits.push(type.displayName || type.name || '');
    }
    return bits.filter(Boolean).join(' ');
}
const ACTION_KEYS = ['actions', 'buttons', 'items', 'headerActions', 'trailingActions', 'toolbarItems'];
const SETTINGS_MESSAGE_KEYS = ['SETTINGS', 'USER_SETTINGS', 'SETTINGS_TITLE', 'OPEN_SETTINGS', 'USER_SETTINGS_BUTTON'];
const OTHER_MESSAGE_KEYS = ['QUESTS', 'SHOP', 'NITRO', 'COLLECTIBLES', 'COLLECTIBLES_SHOP', 'QUEST_HOME'];

function textOf(value, depth = 0) {
    if (value == null || depth > 2) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'function') return value.displayName || value.name || '';
    if (typeof value === 'object') return ['message', 'defaultMessage', 'id', 'displayName', 'name'].map(key => textOf(value[key], depth + 1)).filter(Boolean).join(' ');
    return '';
}
function recordText(record) {
    if (!record || typeof record !== 'object') return '';
    return ['label', 'accessibilityLabel', 'accessibilityHint', 'aria-label', 'testID', 'nativeID', 'id', 'key', 'name', 'route', 'screen', 'icon', 'Icon', 'IconComponent']
        .map(key => textOf(record[key])).filter(Boolean).join(' ');
}
let settingsNeedles = [];
let otherNeedles = [];
function rememberMessages(messages) {
    if (!messages || typeof messages !== 'object') return;
    const take = (keys, bucket) => {
        for (const key of keys) {
            const value = messages[key];
            if (typeof value === 'string' && value.length >= 2 && value.length <= 32 && !bucket.includes(value)) bucket.push(value);
        }
    };
    take(SETTINGS_MESSAGE_KEYS, settingsNeedles);
    take(OTHER_MESSAGE_KEYS, otherNeedles);
}
function isSettingsText(text) {
    if (!text || /notification/i.test(text)) return false;
    if (/settings?|SettingsIcon|GearIcon|CogIcon|USER_SETTINGS|\b(gear|cog)\b/i.test(text)) return true;
    return settingsNeedles.some(word => text.includes(word));
}
function isOtherText(text) {
    if (!text) return false;
    if (/quest|shop|collectible|nitro|QuestIcon|ShopIcon|NitroIcon|CollectiblesIcon/i.test(text)) return true;
    return otherNeedles.some(word => text.includes(word));
}
function pressProps(record) {
    if (!record || typeof record !== 'object' || record.subLabel || record.trailing) return false;
    if (typeof record.label === 'string' && record.label.length > 40) return false;
    return typeof record.onPress === 'function' || typeof record.onPressOut === 'function';
}
function nodeText(node) {
    const props = node?.props;
    if (!props) return '';
    return ['accessibilityLabel', 'accessibilityHint', 'aria-label', 'testID', 'nativeID', 'label', 'name', 'route', 'screen', 'id']
        .map(key => textOf(props[key])).concat(iconHint(node)).filter(Boolean).join(' ');
}
function isIconControl(node) { return pressProps(node?.props); }
export function isSettingsControl(node) { return isIconControl(node) && isSettingsText(nodeText(node)); }
export function isQuestOrShopControl(node) { return isIconControl(node) && isOtherText(nodeText(node)); }
function plainKind(item) {
    if (!pressProps(item) || item.props) return '';
    const text = recordText(item);
    if (isSettingsText(text)) return 'settings';
    if (isOtherText(text)) return 'other';
    return '';
}
function controlKind(node) {
    if (isSettingsControl(node)) return 'settings';
    if (isQuestOrShopControl(node)) return 'other';
    const inner = node?.props?.children;
    const list = Array.isArray(inner) ? inner.filter(Boolean) : inner ? [inner] : [];
    if (list.length !== 1) return '';
    if (isSettingsControl(list[0])) return 'settings-wrap';
    if (isQuestOrShopControl(list[0])) return 'other-wrap';
    return '';
}
export function insertPlainAction(list, makeButton) {
    if (!Array.isArray(list) || list.length < 2 || list.length > 8) return list;
    if (list.some(item => item?.key === 'mime-nighty-profile-button' || item?.id === 'mime-nighty-profile-button')) return list;
    const kinds = list.map(plainKind);
    const index = kinds.indexOf('settings');
    if (index < 0 || !kinds.includes('other')) return list;
    const next = list.slice();
    next.splice(index + 1, 0, makeButton(list[index]));
    return next;
}
// Adds a Nighty control beside Settings. Settings itself is not changed. Only a short row that also has Quests or Shop.
export function insertNightySlot(React, element, makeButton) {
    const children = element?.props?.children;
    const list = Array.isArray(children) ? children.filter(Boolean) : null;
    if (!list || list.length < 2 || list.length > 8) return element;
    if (list.some(node => node?.props?.testID === 'mime-nighty-profile-button')) return element;
    const kinds = list.map(controlKind);
    const index = kinds.findIndex(kind => kind === 'settings' || kind === 'settings-wrap');
    if (index < 0 || !kinds.some(kind => kind === 'other' || kind === 'other-wrap')) return element;
    const node = list[index];
    const sample = kinds[index] === 'settings' ? node
        : (Array.isArray(node.props.children) ? node.props.children.filter(Boolean)[0] : node.props.children);
    const added = makeButton(sample);
    if (!added) return element;
    const next = list.slice();
    next.splice(index + 1, 0, added);
    return React.cloneElement(element, {}, ...next);
}
export default function NightyTab(r) {
    const { h, React, RN, store } = r;
    const { Page, Text, Button, Input, Toggle } = ui(r);
    const iconUrl = () => store.iconType === 'custom' ? pageUrl(store.customIconUrl)
        : store.iconType === 'grayscale' ? grayIcon : blueIcon;
    function Icon() {
        r.useRefresh();
        const uri = iconUrl();
        return uri ? h(RN.View, { style: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' } },
            h(RN.Image, { source: { uri }, resizeMode: 'contain', style: { width: 18, height: 18 }, accessibilityIgnoresInvertColors: true })) : null;
    }
    const sending = new Set();
    async function download(message) {
        if (!r.active || !canDownload(store, message) || sending.has(message.id)) return;
        sending.add(message.id);
        try {
            const module = r.find('HTTP', 'get', 'post', 'put', 'patch', 'del') || r.find('get', 'post', 'put', 'del');
            const rest = module?.HTTP || module;
            if (typeof rest?.post !== 'function') throw new Error('Discord message API unavailable');
            const channelId = messageChannelId(message);
            await rest.post({ url: `/channels/${channelId}/messages`, body: {
                content: `${store.nightyPrefix}dls`,
                message_reference: { message_id: message.id, channel_id: channelId, ...(message.guild_id ? { guild_id: message.guild_id } : {}) },
                allowed_mentions: { parse: [], replied_user: false },
            } });
        } finally { sending.delete(message.id); }
    }
    function pageHost() {
        try {
            const url = new URL(String(store.url).trim());
            return url.protocol === 'https:' && !url.username && !url.password && !/(^|\.)discord(?:app)?\.(?:com|net)$/i.test(url.hostname) ? url.origin : '';
        } catch { return ''; }
    }
    function cleanToken(value) {
        if (typeof value !== 'string') return '';
        const token = value.trim();
        if (token.length < 8 || token.length > 4096 || !/^[\w.~+/-]+=*$/.test(token)) return '';
        return token;
    }
    function sessionToken() {
        const host = pageHost();
        const saved = store.sessions?.[host];
        return host && cleanToken(saved) ? cleanToken(saved) : '';
    }
    // The Nighty page keeps its own access_token. Discord cookies stay out of this WebView.
    function sessionScript(token) {
        return '(' + "function(config) {\n    if (!config.origin || window.top !== window.self || location.origin !== config.origin || window.__mimeNightyCookieV3) return true;\n    window.__mimeNightyCookieV3 = true;\n    const valid = value => typeof value === 'string' && value.length >= 8 && value.length <= 4096 && /^[\\w.~+/-]+=*$/.test(value) ? value : '';\n    let blocked = false, last = '', lastLocal = '', lastCookie = '', revision = 0, timer;\n    try { blocked = sessionStorage.getItem('__mimeNightyLogout') === '1'; } catch {}\n    const emit = (token = '', logout = false) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'NIGHTY_TOKEN', origin: config.origin, token, logout }));\n    const local = () => { try { return valid(localStorage.getItem('access_token')); } catch { return ''; } };\n    const cookie = () => { try { const value = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith('access_token=')); return value ? valid(decodeURIComponent(value.slice(13))) : ''; } catch { return ''; } };\n    const setCookie = value => { try { document.cookie = 'access_token=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + (value ? '2592000' : '0') + '; SameSite=Lax; Secure'; } catch {} };\n    const clear = (erase = true) => {\n        blocked = true; last = ''; revision += 1;\n        try { sessionStorage.setItem('__mimeNightyLogout', '1'); } catch {}\n        if (erase) { try { localStorage.removeItem('access_token'); } catch {} setCookie(''); }\n        emit('', true);\n    };\n    const save = value => {\n        value = valid(value);\n        if (!value) return;\n        blocked = false; revision += 1;\n        try { sessionStorage.removeItem('__mimeNightyLogout'); } catch {}\n        try { if (local() !== value) localStorage.setItem('access_token', value); } catch {}\n        if (cookie() !== value) setCookie(value);\n        lastLocal = local(); lastCookie = cookie();\n        if (last !== value) { last = value; emit(value); }\n    };\n    if (blocked) clear();\n    else save(local() || cookie() || valid(config.token));\n    try {\n        const proto = Object.getPrototypeOf(localStorage), set = proto.setItem, remove = proto.removeItem, empty = proto.clear;\n        proto.setItem = function(key, value) { const result = set.apply(this, arguments); if (this === localStorage && String(key) === 'access_token') { if (valid(String(value))) save(String(value)); else clear(); } return result; };\n        proto.removeItem = function(key) { const result = remove.apply(this, arguments); if (this === localStorage && String(key) === 'access_token' && !blocked) clear(); return result; };\n        proto.clear = function() { const result = empty.apply(this, arguments); if (this === localStorage && !blocked) clear(); return result; };\n    } catch {}\n    const poll = () => {\n        if (blocked || location.origin !== config.origin) return;\n        const l = local(), c = cookie();\n        if ((lastLocal && !l) || (lastCookie && !c)) { clear(); return; }\n        const next = l && l !== lastLocal ? l : c && c !== lastCookie ? c : l || c;\n        lastLocal = l; lastCookie = c;\n        if (next && next !== last) save(next);\n    };\n    const endpoint = value => { try { const url = new URL(typeof value === 'string' ? value : value?.url || '', location.href); return url.origin === config.origin ? url.pathname : ''; } catch { return ''; } };\n    const logout = value => /\\/(?:logout|log-out|signout|sign-out)(?:\\/|$)/i.test(value);\n    const login = value => /\\/(?:login|log-in|signin|sign-in)(?:\\/|$)/i.test(value);\n    const receive = (path, data, started) => { if (revision === started && (!blocked || login(path))) save(data?.access_token); };\n    if (typeof window.fetch === 'function') {\n        const original = window.fetch;\n        window.fetch = function(input) {\n            const path = endpoint(input); if (logout(path)) clear(false); const started = revision;\n            return original.apply(this, arguments).then(response => {\n                if (logout(path)) clear();\n                else if (path && response.ok && response.clone && (!response.url || endpoint(response.url))) response.clone().json().then(data => receive(path, data, started)).catch(() => {});\n                return response;\n            }, error => { if (logout(path)) clear(); throw error; });\n        };\n    }\n    if (window.XMLHttpRequest?.prototype) {\n        const proto = window.XMLHttpRequest.prototype, open = proto.open, send = proto.send, paths = new WeakMap();\n        proto.open = function(method, url) { paths.set(this, endpoint(url)); return open.apply(this, arguments); };\n        proto.send = function() {\n            const path = paths.get(this) || ''; if (logout(path)) clear(false); const started = revision;\n            if (logout(path)) this.addEventListener('loadend', () => clear(), { once: true });\n            else if (path) this.addEventListener('load', () => { if (this.status >= 200 && this.status < 300 && (!this.responseURL || endpoint(this.responseURL))) { try { receive(path, this.responseType === 'json' ? this.response : JSON.parse(this.responseText), started); } catch {} } }, { once: true });\n            return send.apply(this, arguments);\n        };\n    }\n    window.addEventListener('storage', event => { if (event.storageArea === localStorage && (event.key === null || event.key === 'access_token')) { if (!valid(event.newValue)) clear(); else save(event.newValue); } });\n    document.addEventListener('click', event => { const link = event.target?.closest?.('a[href]'); if (link && logout(endpoint(link.href))) clear(false); }, true);\n    document.addEventListener('submit', event => { if (logout(endpoint(event.target?.action))) clear(false); }, true);\n    const start = () => { if (!timer) timer = setInterval(poll, 1000); };\n    window.addEventListener('pagehide', () => { poll(); clearInterval(timer); timer = undefined; });\n    window.addEventListener('pageshow', start); start(); return true;\n}" + ')(' + JSON.stringify({ origin: pageHost(), token: cleanToken(token) }) + ');true;';
    }
    function onSessionMessage(event) {
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
    }
    function readInset(edge) {
        try {
            const mod = r.find('initialWindowMetrics') || r.find('useSafeAreaInsets') || {};
            const insets = mod.initialWindowMetrics?.insets || mod.insets;
            const value = insets?.[edge];
            if (typeof value === 'number' && value > 0 && value < 80) return Math.round(value);
        } catch { /* The navigator already keeps the page on screen when no inset is published. */ }
        return 0;
    }
    function NightyPage() {
        r.useRefresh();
        const src = pageUrl(store.url);
        const WebView = r.find('WebView')?.WebView || r.byName('WebView');
        const [error, setError] = React.useState('');
        // The navigator already places this under the header. A window-height frame paints past the bottom of the screen.
        const frame = { flex: 1, width: '100%', paddingBottom: readInset('bottom') };
        // about:blank is the WebView's first load; blocking it leaves the page empty on iOS.
        const allow = req => {
            const url = req?.url || '';
            return !url || url === 'about:blank' || url === src || !!pageUrl(url);
        };
        return h(RN.View, { style: frame },
            !src ? h(Text, null, 'Set a valid HTTP or HTTPS URL in Nighty Tab settings.')
                : !WebView ? h(Text, null, 'WebView is unavailable in this Snow build.')
                    : h(WebView, {
                        key: src, source: { uri: src, ...(sessionToken() ? { headers: {} } : {}) },
                        style: { flex: 1, width: '100%' },
                        originWhitelist: ['http://*', 'https://*'], javaScriptEnabled: true, domStorageEnabled: true,
                        sharedCookiesEnabled: false, thirdPartyCookiesEnabled: false, incognito: false, startInLoadingState: true,
                        injectedJavaScriptBeforeContentLoaded: sessionScript(sessionToken()),
                        injectedJavaScript: sessionScript(sessionToken()),
                        onMessage: onSessionMessage,
                        onShouldStartLoadWithRequest: allow,
                        onError: event => setError(event.nativeEvent?.description || 'Could not load Nighty.'),
                        onHttpError: event => setError(`Nighty returned HTTP ${event.nativeEvent?.statusCode}.`),
                        onLoad: () => setError(''),
                    }),
            error ? h(Text, null, error) : null);
    }
    function Settings({ close }) {
        r.useRefresh();
        return h(Page, { title: 'Nighty Tab', close },
            h(Text, null, 'URL'), h(Input, { value: store.url, placeholder: 'https://', autoCapitalize: 'none', onChange: v => r.set('url', v) }),
            store.url && !pageUrl(store.url) ? h(Text, null, 'Enter an HTTP or HTTPS URL without embedded credentials.') : null,
            h(Button, { text: 'Open Nighty', onPress: () => { if (!openNighty()) openSheet(); } }),
            h(Toggle, { setting: 'showNightyButton', label: 'Profile Nighty button', subLabel: 'Adds a Nighty button beside Settings on your profile. It uses the same icon as the Nighty settings row.' }),
            h(Toggle, { setting: 'scriptUtils', label: 'Script Utils functions', subLabel: 'Download Script replies to an attachment with your prefix followed by dls.' }),
            h(Text, null, 'Nighty prefix (one character)'),
            h(Input, { value: store.nightyPrefix, onChange: v => r.set('nightyPrefix', v), autoCapitalize: 'none', placeholder: '.' }),
            ...['blue', 'grayscale', 'custom'].map(style => h(Button, { key: style, text: `${store.iconType === style ? '✓ ' : ''}${style} icon`, onPress: () => r.set('iconType', style) })),
            store.iconType === 'custom' ? h(Input, { value: store.customIconUrl, placeholder: 'https:// image URL', autoCapitalize: 'none', onChange: v => r.set('customIconUrl', v) }) : null,
            h(Icon), h(Text, { muted: true }, `Settings entry: ${r.status.settingsEntry ? 'registered' : 'unavailable'} · Message menu: ${r.status.messageMenu ? 'registered' : 'unavailable'} · Profile button: ${store.showNightyButton ? (r.status.profileButton === 'added' ? 'added beside Settings' : 'watching') : 'off'}`));
    }
    function screenNavigator() {
        const found = r.byName('Navigator', true) || r.byName('Navigator') || r.find('Navigator');
        if (typeof found === 'function') return found;
        if (typeof found?.Navigator === 'function') return found.Navigator;
        if (typeof found?.default === 'function') return found.default;
        return null;
    }
    // Push Discord's own full-screen navigator. This opens Nighty directly and does not open Settings first.
    function openNighty() {
        if (!r.active) return false;
        const navigation = r.common.navigation || r.find('push', 'pushLazy', 'pop');
        if (typeof navigation?.push !== 'function') return false;
        const Navigator = screenNavigator();
        const close = () => navigation.pop?.();
        const headerLeft = discordClose(close) || (() => closeMark(close));
        function Screen() {
            if (Navigator) return h(Navigator, {
                initialRouteName: 'Nighty',
                goBackOnBackPress: true,
                screens: {
                    Nighty: {
                        title: 'Nighty',
                        headerBackVisible: false,
                        headerLeft,
                        render: () => r.active ? h(NightyPage, { close }) : null,
                    },
                },
            });
            return h(RN.View, { style: { flex: 1, width: '100%' } }, renderClose(close), h(NightyPage, { close }));
        }
        Screen.displayName = 'Nighty';
        try { navigation.push(Screen); return true; }
        catch (error) { if (r.active) r.error('Open Nighty', error); return false; }
    }
    function openSheet() {
        try { r.open('nighty', NightyPage, {}, { scrollable: false }); }
        catch (error) { if (r.active) r.error('Open Nighty', error); }
    }
    function press() {
        return () => { if (r.active && store.showNightyButton && !openNighty()) openSheet(); };
    }
    // Same artwork as the settings-row Icon, as a host Image so the toolbar can draw it directly.
    function toolbarIcon() {
        const uri = iconUrl();
        if (!uri) return null;
        return h(RN.Image, {
            source: { uri },
            resizeMode: 'contain',
            fadeDuration: 0,
            accessibilityIgnoresInvertColors: true,
            style: { width: 48, height: 32 },
        });
    }
    // Taller than the mark, with contain, so the pill can clip the frame without cutting the logo.
    function profileImage() {
        const uri = iconUrl();
        if (!uri) return null;
        return h(RN.View, { style: { width: 52, height: 40, alignItems: 'center', justifyContent: 'center', overflow: 'visible' } },
            h(RN.Image, {
                source: { uri },
                resizeMode: 'contain',
                fadeDuration: 0,
                accessibilityIgnoresInvertColors: true,
                style: { width: 48, height: 32 },
            }));
    }
    // Discord's header close control is the X. It replaces the back chevron.
    function discordClose(onClose) {
        const module = r.find('getRenderCloseButton') || r.find('getHeaderCloseButton');
        const render = module?.getRenderCloseButton || module?.getHeaderCloseButton;
        if (typeof render !== 'function') return null;
        try { return render(onClose) || null; }
        catch (error) { if (r.active) r.error('Nighty close button', error); return null; }
    }
    function closeMark(onClose) {
        return h(RN.Pressable || RN.TouchableOpacity, {
            accessibilityLabel: 'Close',
            accessibilityRole: 'button',
            onPress: onClose,
            hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
            style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        }, h(RN.Text, { style: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 } }, '✕'));
    }
    function renderClose(onClose) {
        const control = discordClose(onClose);
        if (typeof control === 'function') return h(control);
        return control || closeMark(onClose);
    }
    // Own pressable so the toolbar cannot drop the label. Settings' onPress is left untouched.
    function NightyProfileButton({ sample }) {
        r.useRefresh();
        const [open, setOpen] = React.useState(false);
        const Modal = RN.Modal;
        const close = () => setOpen(false);
        return h(RN.Pressable || RN.TouchableOpacity, {
            accessibilityLabel: 'Nighty',
            accessibilityHint: 'Open Nighty',
            accessibilityRole: 'button',
            testID: 'mime-nighty-profile-button',
            hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
            onPress: () => {
                if (!r.active || !store.showNightyButton) return;
                if (!openNighty()) setOpen(true);
            },
            style: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
        },
        profileImage(),
        open && Modal ? h(Modal, {
            visible: true,
            animationType: 'slide',
            presentationStyle: 'fullScreen',
            statusBarTranslucent: true,
            onRequestClose: close,
        }, h(RN.View, { style: { flex: 1, width: '100%', paddingTop: readInset('top') } },
            renderClose(close),
            h(NightyPage, { close }))) : null);
    }
    function nightyControl(sample) {
        return h(NightyProfileButton, { key: 'mime-nighty-profile-button', sample });
    }
    function nightyRecord(sample) {
        const image = toolbarIcon();
        const record = sample && typeof sample === 'object' ? { ...sample } : {};
        for (const key of Object.keys(record)) {
            if (typeof record[key] === 'string' && isSettingsText(record[key])) record[key] = 'Nighty';
        }
        record.key = 'mime-nighty-profile-button';
        record.id = 'mime-nighty-profile-button';
        record.label = 'Nighty';
        record.text = 'Nighty';
        record.accessibilityLabel = 'Nighty';
        record.accessibilityHint = 'Open Nighty';
        record.IconComponent = Icon;
        record.icon = typeof sample?.icon === 'function' ? Icon : image;
        record.onPress = press();
        return record;
    }
    function applyToolbar(element) {
        if (!r.active || !store.showNightyButton || !element?.props) return element;
        const slotted = insertNightySlot(r.React, element, nightyControl);
        if (slotted !== element) { r.status.profileButton = 'added'; return slotted; }
        let changed = false;
        const props = {};
        for (const key of ACTION_KEYS) {
            const next = insertPlainAction(element.props[key], nightyRecord);
            if (next !== element.props[key]) { props[key] = next; changed = true; }
        }
        if (!changed) return element;
        r.status.profileButton = 'added';
        return r.React.cloneElement(element, props);
    }
    const watched = new Set();
    function watch(parent, key) {
        const fn = parent?.[key];
        if (typeof fn !== 'function' || watched.has(fn)) return false;
        watched.add(fn);
        return r.patch('after', parent, key, (_args, result) => {
            const next = applyToolbar(result);
            return next === result ? undefined : next;
        });
    }
    return { Settings, NightyPage, download, start() {
        r.status.settingsEntry = registerSection(r, { name: 'Nighty', items: [{ key: 'MIME_NIGHTY', title: () => 'Nighty', headerShown: false, IconComponent: Icon, render: async () => ({ default: NightyPage }) }] });
        r.status.messageMenu = patchLazySheet(r, (key, props) => key === 'MessageLongPressActionSheet' && canDownload(store, props?.message)
            ? { key: 'mime-nighty-download', label: 'Download Script', icon: h(Icon), onPress: () => download(props.message) } : null);
        rememberMessages(r.common?.i18n?.Messages || r.find('Messages')?.Messages);
        // Patch element creation only. Wrapping YouScreen and cloning its tree crashes RCTView.
        const patched = watch(React, 'createElement');
        for (const key of ['jsx', 'jsxs']) watch(React, key);
        const metro = r.B.metro;
        const factories = [r.B._jsx, r.host?._jsx];
        try {
            const found = metro?.findByPropsAll?.('jsx', 'jsxs') || [];
            factories.push(...found, metro?.findByProps?.('jsx', 'jsxs'));
        } catch { /* finder shape differs between Snow builds */ }
        for (const factory of factories) {
            watch(factory, 'jsx');
            watch(factory, 'jsxs');
        }
        r.status.profileButton = patched === false ? 'unavailable' : (r.status.profileButton === 'replaced' ? 'replaced' : 'patched');
    } };
}
NightyTab.defaults = { url: '', scriptUtils: false, nightyPrefix: '.', iconType: 'blue', customIconUrl: '', showNightyButton: true, sessions: {} };
