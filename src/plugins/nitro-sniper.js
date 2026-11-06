// Independent Snow implementation of neoarz/NitroSniper (MIT).
import { ui } from '../runtime.js';
import { captchaErrorInfo, createCaptchaSolver } from './captcha.js';
export function giftCodes(text) {
    return [...new Set(Array.from(String(text || '').matchAll(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gift\/|discord(?:app)?\.com\/gifts\/)([A-Za-z0-9]{16,24})(?![A-Za-z0-9])/g), m => m[1]))];
}
export function webhookUrl(value) {
    if (!String(value || '').trim()) return null;
    const u = new URL(String(value).trim());
    if (u.protocol !== 'https:' || !['discord.com', 'canary.discord.com', 'ptb.discord.com'].includes(u.hostname) || !/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+\/?$/.test(u.pathname) || u.username || u.password) throw new Error('Use a Discord HTTPS webhook URL');
    return u.href;
}
export default function NitroSniper(r) {
    const { h, React } = r, { Page, Text, Button, Input, Toggle } = ui(r);
    const solver = createCaptchaSolver(r, React);
    const seen = new Map(), queue = [];
    let running = false, stopped = false, started = Date.now(), waitTimer, releaseWait;
    const stats = { queued: 0, claimed: 0, failed: 0, lastResult: 'Waiting for new gift links' };
    function wait(ms) { return new Promise(resolve => { releaseWait = resolve; waitTimer = setTimeout(resolve, ms); }); }
    async function webhook(payload) {
        const url = webhookUrl(r.store.webhookUrl);
        if (url) await r.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'NitroSniper', allowed_mentions: { parse: [] }, ...payload }) });
    }
    async function drain() {
        if (running) return;
        running = true;
        try {
            while (queue.length && r.active && !stopped) {
                const item = queue.shift();
                let success = false, result = '', giftType;
                r.toast('Claiming gift…', 'GiftIcon');
                try {
                    // A single request path; never retry an uncertain timeout or run a second callback API.
                    let captchaKey, captchaRqtoken;
                    for (let attempt = 0; ; attempt++) {
                        try {
                            const payload = { channel_id: item.channelId || null };
                            if (captchaKey) {
                                payload.captcha_key = captchaKey;
                                if (captchaRqtoken) payload.captcha_rqtoken = captchaRqtoken;
                            }
                            await r.discord(`/entitlements/gift-codes/${item.code}/redeem`, { method: 'POST', body: JSON.stringify(payload) }); break;
                        }
                        catch (e) {
                            const cap = !captchaKey && captchaErrorInfo(e);
                            if (cap && cap.sitekey && cap.service === 'hcaptcha') {
                                r.toast('Solving captcha…', 'ShieldIcon');
                                stats.lastResult = 'Solving hCaptcha…'; r.changed();
                                const token = await solver.solve(cap.sitekey);
                                captchaKey = token;
                                captchaRqtoken = cap.rqtoken;
                                attempt--; // don't consume attempts on the captcha round-trip
                                continue;
                            }
                            if (e.status !== 429 || attempt >= 2 || e.retryAfter <= 0 || e.retryAfter > 120) throw e;
                            stats.lastResult = `Rate limited; retrying in ${Math.ceil(e.retryAfter)}s`; r.changed();
                            await wait(e.retryAfter * 1000 + 100);
                            if (stopped || !r.active) return;
                        }
                    }
                    success = true; result = 'Gift claimed';
                } catch (e) { result = `Claim failed: ${e.message}`; }
                if (stopped || !r.active) return;
                stats[success ? 'claimed' : 'failed']++; stats.lastResult = result; r.changed();
                r.toast(result, success ? 'NitroWheelIcon' : 'CircleXIcon');
                if (r.store.webhookUrl) {
                    try {
                        try { const resolved = (await r.discord(`/entitlements/gift-codes/${item.code}?with_application=false&with_subscription_plan=true`)).json(); giftType = resolved?.subscription_plan?.name || resolved?.store_listing?.sku?.name; } catch { /* Optional enrichment; claim result remains visible. */ }
                        if (!r.active || stopped) return;
                        const fields = [];
                        if (giftType) fields.push({ name: 'Gift type', value: String(giftType).slice(0, 1024) });
                        if (item.authorId) fields.push({ name: 'Sent by', value: `[${String(item.authorName || item.authorId).replace(/[\[\]\\]/g, '')}](https://discord.com/users/${item.authorId})` });
                        if (item.channelId && item.messageId) fields.push({ name: 'Message', value: `https://discord.com/channels/${item.guildId || '@me'}/${item.channelId}/${item.messageId}` });
                        await webhook({ embeds: [{ title: result.slice(0, 256), color: success ? 0x43b581 : 0xf04747, fields, timestamp: new Date().toISOString() }] });
                    } catch (e) { if (r.active) r.error('Webhook delivery failed', e); }
                }
            }
        } finally { running = false; }
    }
    function receive(event) {
        const m = event?.message;
        if (!m || stopped || event.optimistic || event.isPushNotification) return;
        const timestamp = m.timestamp ? new Date(m.timestamp).getTime() : Number(BigInt(m.id || '0') >> 22n) + 1420070400000;
        if (!Number.isFinite(timestamp) || timestamp < started) return;
        const self = r.byStore('UserStore')?.getCurrentUser?.()?.id;
        if (r.store.ignoreOwnGiftLinks && m.author?.id === self) return;
        for (const code of giftCodes(m.content)) {
            if (seen.has(code)) continue;
            seen.set(code, Date.now());
            if (seen.size > 4096) seen.delete(seen.keys().next().value);
            if (queue.length >= 100) { stats.lastResult = 'Queue full; skipped gift'; r.changed(); continue; }
            queue.push({ code, channelId: m.channel_id || m.channelId, guildId: m.guild_id || m.guildId, messageId: m.id, authorId: m.author?.id, authorName: m.author?.globalName || m.author?.global_name || m.author?.username }); stats.queued++;
        }
        r.changed(); void drain().catch(e => r.active && r.error('Gift queue', e));
    }
    function Settings() {
        r.useRefresh(); const [url, setUrl] = React.useState(r.store.webhookUrl || '');
        const [solverUrl, setSolverUrl] = React.useState(r.store.captchaSolverUrl || '');
        return h(Page, { title: 'NitroSniper' }, h(Toggle, { setting: 'ignoreOwnGiftLinks', label: 'Ignore my gift links' }),
            h(Text, null, `Queued ${stats.queued} · Claimed ${stats.claimed} · Failed ${stats.failed}`), h(Text, null, stats.lastResult),
            h(Input, { label: 'Optional result webhook', value: url, onChange: setUrl, secureTextEntry: true, autoCapitalize: 'none' }),
            h(Button, { text: 'Save webhook', onPress: async () => { try { webhookUrl(url); r.set('webhookUrl', url.trim()); await r.api.storage.flush(); r.toast('Saved'); } catch (e) { r.error('Webhook', e); } } }),
            h(Button, { text: 'Send test webhook', variant: 'secondary', onPress: () => webhook({ content: 'NitroSniper Snow webhook test' }).then(() => r.toast(r.store.webhookUrl ? 'Test sent' : 'Set a webhook first')).catch(e => r.error('Webhook test', e)) }),
            h(Input, { label: 'Optional captcha solver URL (fully automated)', value: solverUrl, onChange: setSolverUrl, autoCapitalize: 'none', placeholder: 'https://your-solver/api' }),
            h(Button, { text: 'Save solver URL', variant: 'secondary', onPress: async () => { try { if (solverUrl.trim()) { new URL(solverUrl.trim()); } r.set('captchaSolverUrl', solverUrl.trim()); await r.api.storage.flush(); r.toast('Saved'); } catch (e) { r.error('Solver URL', e); } } }),
            h(Text, { muted: true }, 'Automatically solves hCaptcha when Discord requires it: on-screen widget by default, external solver endpoint if set. Only new live messages are processed.'));
    }
    return { start() { started = Date.now(); r.subscribe('MESSAGE_CREATE', e => { try { receive(e); } catch (err) { r.error('Message handler', err); } }); }, stop() { stopped = true; solver.dispose(); queue.length = 0; clearTimeout(waitTimer); releaseWait?.(); }, Settings, receive, stats };
}
NitroSniper.defaults = { ignoreOwnGiftLinks: false, webhookUrl: '', captchaSolverUrl: '' };
