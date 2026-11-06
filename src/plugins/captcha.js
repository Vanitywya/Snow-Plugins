// Automated hCaptcha solving for gift redemption on Snow (mobile Discord).
// Renders the real hCaptcha widget inside a mounted WebView sheet and
// executes it programmatically. When hCaptcha demands interaction, the
// challenge renders on-screen for a single tap; an optional external
// solver endpoint can drive fully hands-off redemption instead.

export function captchaErrorInfo(e) {
    const body = e?.body || {};
    if (body.captcha_required || body.captcha_service || body.captcha_sitekey) {
        return {
            service: body.captcha_service || 'hcaptcha',
            sitekey: body.captcha_sitekey || body.captcha_site_key || null,
            rqtoken: body.captcha_rqtoken || body.captcha_rq_token || null,
        };
    }
    return null;
}

const CAPTCHA_HTML = [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<script src="https://js.hcaptcha.com/1/api.js?render=explicit" onload="window.__apiReady=true"><\/script>',
    '</head><body style="margin:0">',
    '<div id="box" style="position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center"></div>',
    '<script>',
    'var widgetId = null, rqdata = null;',
    'function post(type, data) {',
    '  var payload = Object.assign({ type: type }, data || {});',
    '  try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (e) {}',
    '}',
    'post("ready", { apiReady: !!window.__apiReady });',
    'window.solveCaptcha = function (sk, rq) {',
    '  try {',
    '    rqdata = rq || null;',
    '    if (window.hcaptcha && window.hcaptcha.setRqdata && rqdata) { try { hcaptcha.setRqdata(rqdata); } catch (e) {} }',
    '    if (widgetId !== null) { try { hcaptcha.reset(widgetId); } catch (e) {} }',
    '    else {',
    '      var opts = {',
    '        sitekey: sk,',
    '        size: "invisible",',
    '        callback: function (token) { post("token", { token: token }); },',
    '        "error-callback": function (err) { post("error", { message: String(err) }); },',
    '        "expired-callback": function () { post("error", { message: "captcha expired" }); },',
    '        "chalexpired-callback": function () { post("error", { message: "challenge expired" }); },',
    '        "open-callback": function () { post("challenge_opened", {}); },',
    '        "close-callback": function () { post("challenge_closed", {}); }',
    '      };',
    '      if (rqdata) opts.rqdata = rqdata;',
    '      widgetId = hcaptcha.render("box", opts);',
    '    }',
    '    hcaptcha.execute(widgetId);',
    '  } catch (e) { post("error", { message: String(e && e.message || e) }); }',
    '};',
    '<\/script></body></html>',
].join('');

// Desktop UA: hCaptcha serves the invisible desktop flow instead of the
// mobile TouchUI interstitial ("Are you a human?" + Confirm button), so
// hcaptcha.execute() can pass passively with no tap required.
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const SOLVER_TIMEOUT = 60000;
const MAX_AUTO_RETRY = 3;

export function createCaptchaSolver(r, React) {
    const WebView = r.find('WebView')?.WebView || r.byName('WebView');
    let sheetClose = null;
    let pending = null;
    let requestId = 0;
    let epoch = 0; // bumped to force a WebView remount (fresh page, fresh widget)

    function closeSheet() {
        if (!sheetClose) return;
        const close = sheetClose;
        sheetClose = null;
        try { close(); } catch { /* sheet may already be gone */ }
    }

    function mountHost() {
        if (sheetClose || !React) return;
        try {
            // r.open mounts through Snow's real bottom-sheet API (showSheet)
            // and returns its close function. The runtime tracks unmount itself.
            sheetClose = r.open('captcha', function CaptchaHost() {
                return element() || null;
            }, {}, { scrollable: false });
        } catch {
            sheetClose = null;
        }
    }

    async function solveViaEndpoint(sitekey) {
        const url = String(r.store.captchaSolverUrl || '').trim();
        if (!url) return null;
        // Generic capsolver/2captcha-style JSON API: POST { sitekey, pageurl } -> { token }
        const res = await r.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sitekey, pageurl: 'https://discord.com' }),
        }, 120000);
        const body = res.json();
        const token = body?.token || body?.solution?.token || body?.request || null;
        if (!token || typeof token !== 'string') throw new Error('solver endpoint returned no token');
        return token;
    }

    function solve(sitekey, rqtoken) {
        return new Promise((resolvePromise, rejectPromise) => {
            const p = { pending: true, resolvePromise, rejectPromise, sitekey, rqtoken: rqtoken || null, id: ++requestId };
            const settle = (ok, value) => { if (p.pending) { p.pending = false; ok ? p.resolvePromise(value) : p.rejectPromise(value); } };

            // Prefer an external solver when configured: fully automated redemption.
            solveViaEndpoint(sitekey).then(token => {
                if (token) { settle(true, token); r.changed(); } else startWidget();
            }).catch(() => startWidget());

            function startWidget() {
                if (!p.pending) return;
                if (!WebView) { settle(false, new Error('WebView unavailable in this Snow build')); return; }
                pending = p;
                epoch++;
                p.retries = 0;
                mountHost();
                if (!sheetClose) { settle(false, new Error('captcha sheet unavailable in this Snow build')); return; }
                r.changed();
                setTimeout(() => {
                    if (pending === p && p.pending) {
                        pending = null;
                        closeSheet();
                        settle(false, new Error('captcha solve timed out (widget did not return a token in 60s)'));
                        r.changed();
                    }
                }, SOLVER_TIMEOUT);
            }
        });
    }

    function handleMessage(data) {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        const current = pending;
        if (!current || !current.pending) return;
        if (msg.type === 'token') {
            pending = null;
            closeSheet();
            current.pending = false;
            current.resolvePromise(String(msg.token));
            r.changed();
        } else if (msg.type === 'error') {
            if (current.retries < MAX_AUTO_RETRY) {
                // Remount the WebView (epoch bump -> new key -> fresh page) and re-execute.
                current.retries++;
                epoch++;
                r.changed();
                return;
            }
            pending = null;
            closeSheet();
            current.pending = false;
            current.rejectPromise(new Error(`captcha widget: ${msg.message || 'unknown error'}`));
            r.changed();
        } else if (msg.type === 'challenge_opened') {
            r.toast('hCaptcha needs one tap — finish the puzzle on screen', 'ShieldIcon');
            r.changed();
        }
    }

    function element() {
        if (!pending || !pending.pending || !WebView || !React) return null;
        const sitekey = String(pending.sitekey || '');
        const rq = pending.rqtoken ? JSON.stringify(pending.rqtoken) : 'null';
        const inject = 'if (window.solveCaptcha) { window.solveCaptcha(' + JSON.stringify(sitekey) + ', ' + rq + '); } else { setTimeout(function () { window.solveCaptcha && window.solveCaptcha(' + JSON.stringify(sitekey) + ', ' + rq + '); }, 1500); }';
        return React.createElement(WebView, {
            key: `captcha-${pending.id}-${epoch}`,
            source: { html: CAPTCHA_HTML, baseUrl: 'https://discord.com' },
            originWhitelist: ['*'],
            javaScriptEnabled: true,
            domStorageEnabled: true,
            // Desktop UA makes hCaptcha serve the invisible desktop flow instead
            // of the mobile TouchUI interstitial, so execute() can pass passively.
            userAgent: DESKTOP_UA,
            applicationUserAgent: DESKTOP_UA,
            style: { height: '100%', width: '100%' },
            injectedJavaScript: inject,
            onMessage: (event) => handleMessage(event?.nativeEvent?.data),
        });
    }

    function dispose() {
        closeSheet();
        if (pending && pending.pending) {
            pending.pending = false;
            pending.rejectPromise(new Error('captcha solver disposed'));
        }
        pending = null;
    }

    return { solve, element, handleMessage, isPending: () => !!(pending && pending.pending), dispose };
}
