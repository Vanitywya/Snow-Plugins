var plugin = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // NightyTab.entry.js
  var NightyTab_entry_exports = {};
  __export(NightyTab_entry_exports, {
    default: () => NightyTab_entry_default
  });

  // project:src/runtime.js
  function createRuntime(B, meta, defaults = {}) {
    const React = B.React;
    const RN = B.ReactNative;
    if (!React?.createElement || !RN?.View) throw new Error(`${meta.name}: host React/React Native unavailable`);
    const D = B.metro?.common?.components || {};
    const C = B.ui?.components || D;
    const cleanups = [];
    const listeners = /* @__PURE__ */ new Set();
    const requests = /* @__PURE__ */ new Set();
    const openSheets = /* @__PURE__ */ new Map();
    const control = new AbortController();
    let active = true;
    const initial = JSON.parse(JSON.stringify(defaults));
    const store = B.plugin?.createStorage ? B.plugin.createStorage(initial) : initial;
    for (const [key, value] of Object.entries(initial)) if (store[key] === void 0) store[key] = value;
    const alerts = /* @__PURE__ */ new Set();
    const r = {
      B,
      meta,
      React,
      RN,
      C,
      D,
      h: React.createElement,
      store,
      metro: B.metro,
      common: B.metro?.common || {},
      host: B,
      context: { signal: control.signal },
      get active() {
        return active && !control.signal.aborted;
      },
      status: {},
      api: {
        commands: B.commands || B.api?.commands,
        flux: B.flux || B.api?.flux,
        patcher: B.patcher || B.api?.patcher,
        storage: {
          createStorage: () => store,
          get value() {
            return store;
          },
          flush: () => B.plugin?.flushStorage?.() || Promise.resolve()
        },
        ui: {
          ...B.ui,
          openAlert(id, element) {
            if (!r.active) return;
            alerts.add(id);
            return B.ui.openAlert(id, element);
          },
          dismissAlert(id) {
            alerts.delete(id);
            return B.ui.dismissAlert(id);
          }
        }
      },
      own(fn) {
        if (typeof fn === "function") cleanups.push(fn);
        return fn;
      },
      changed() {
        for (const fn of listeners) fn();
      },
      useRefresh() {
        B.plugin?.useProxy?.(store);
        const [, bump] = React.useState(0);
        React.useEffect(() => {
          if (!r.active) return;
          const fn = () => bump((n) => n + 1);
          listeners.add(fn);
          return () => listeners.delete(fn);
        }, []);
        return () => r.changed();
      },
      set(key, value) {
        if (!r.active) return;
        store[key] = value;
        r.changed();
        Promise.resolve(B.plugin?.flushStorage?.()).catch((e) => r.error("Save settings", e));
      },
      find(...props) {
        try {
          return B.metro.findByProps?.(...props);
        } catch {
          return void 0;
        }
      },
      byName(name, raw = false) {
        try {
          return B.metro.findByName?.(name, !raw) || B.metro.findByDisplayName?.(name, !raw);
        } catch {
          return void 0;
        }
      },
      byStore(name) {
        try {
          return B.metro.findByStoreName?.(name);
        } catch {
          return void 0;
        }
      },
      toast(message, icon) {
        if (!r.active) return;
        const text = String(message);
        const show = B.ui?.showToast || B.ui?.toasts?.showToast;
        if (typeof show !== "function") return;
        if (icon) {
          try {
            show(text, icon);
            return;
          } catch {
          }
          try {
            show({ content: text, icon });
            return;
          } catch {
          }
        }
        show(text);
      },
      error(label, error) {
        const text = `${label}: ${error?.message || error}`;
        console.error(`[${meta.name}]`, text);
        r.status.lastError = text;
        r.changed();
        r.toast(text);
      },
      patch(kind, parent, key, callback) {
        const patcher = r.api.patcher;
        if (typeof parent?.[key] !== "function" || typeof patcher?.[kind] !== "function") return false;
        r.own(patcher[kind](key, parent, callback));
        return true;
      },
      subscribe(type, callback) {
        const flux = r.api.flux;
        if (typeof flux?.subscribe !== "function") throw new Error(`${meta.name}: flux.subscribe unavailable`);
        return r.own(flux.subscribe(type, (payload) => {
          if (r.active) callback(payload);
        }));
      },
      channelId(ctx) {
        if (typeof ctx === "string" && /^\d{5,}$/.test(ctx)) return ctx;
        if (ctx && !Array.isArray(ctx)) {
          const id = ctx.channel?.id || ctx.channel?.channelId || ctx.channelId || ctx.channel_id;
          if (id) return id;
        }
        const selected = r.byStore("SelectedChannelStore");
        return selected?.getChannelId?.() || selected?.getCurrentlySelectedChannelId?.() || selected?.getLastSelectedChannelId?.() || null;
      },
      local(channelId, content) {
        if (!r.active) return false;
        const util = r.find("sendBotMessage");
        if (typeof util?.sendBotMessage === "function") {
          try {
            util.sendBotMessage(channelId, content);
            return true;
          } catch {
          }
        }
        r.toast(String(content));
        return false;
      },
      command(command) {
        const register2 = r.api.commands?.registerCommand;
        if (typeof register2 !== "function") throw new Error(`${meta.name}: commands.registerCommand unavailable`);
        const name = command.name;
        const execute = command.execute;
        const prepared = {
          ...command,
          name,
          options: (command.options || []).map((opt) => ({ ...opt })),
          async execute(args, ctx) {
            if (!r.active) return;
            try {
              const result = await execute(args, ctx);
              if (!r.active) return;
              return result;
            } catch (error) {
              if (r.active) r.error(`/${name}`, error);
            }
          }
        };
        return r.own(register2(prepared));
      },
      wait(ms) {
        if (!r.active) return Promise.reject(new Error("Plugin stopped"));
        return new Promise((resolve, reject) => {
          const finish = () => {
            clearTimeout(timer);
            control.signal.removeEventListener("abort", abort);
          };
          const abort = () => {
            finish();
            reject(new Error("Plugin stopped"));
          };
          const timer = setTimeout(() => {
            finish();
            resolve();
          }, ms);
          control.signal.addEventListener("abort", abort, { once: true });
        });
      },
      async request(url, options = {}, timeout = 15e3, maxBytes = Infinity) {
        if (!r.active) throw new Error("Plugin stopped");
        const controller = new AbortController();
        let rejectDeadline;
        const deadline = new Promise((_, reject) => {
          rejectDeadline = reject;
        });
        const abort = () => {
          controller.abort();
          rejectDeadline(new Error(r.active ? "Request timed out" : "Plugin stopped"));
        };
        requests.add(abort);
        control.signal.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(abort, timeout);
        try {
          const response = await Promise.race([fetch(url, { ...options, signal: controller.signal }), deadline]);
          if (Number(response.headers?.get("content-length")) > maxBytes) {
            controller.abort();
            throw new Error("Response exceeds the preview size limit");
          }
          const text = await Promise.race([response.text(), deadline]);
          if (text.length > maxBytes) throw new Error("Response exceeds the preview size limit");
          if (!r.active) throw new Error("Plugin stopped");
          if (!response.ok) {
            let body;
            try {
              body = JSON.parse(text);
            } catch {
              body = {};
            }
            const error = new Error(body.message || `HTTP ${response.status}`);
            error.status = response.status;
            error.retryAfter = Number(body.retry_after) || 0;
            throw error;
          }
          return { response, text, json() {
            return text ? JSON.parse(text) : null;
          } };
        } finally {
          clearTimeout(timer);
          requests.delete(abort);
          control.signal.removeEventListener("abort", abort);
        }
      },
      async discord(path, options = {}) {
        if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid Discord API path");
        if (!r.active) throw new Error("Plugin stopped");
        const found = r.find("HTTP", "get", "post", "put", "patch", "del") || r.find("get", "post", "put", "del");
        const client = found?.HTTP || found;
        const method = (options.method || "GET").toLowerCase().replace(/^delete$/, "del");
        if (typeof client?.[method] !== "function") throw new Error("Discord HTTP client unavailable");
        try {
          const response = await client[method]({ url: path, ...options.body != null ? { body: typeof options.body === "string" ? JSON.parse(options.body) : options.body } : {} });
          if (!r.active) throw new Error("Plugin stopped");
          if (response?.status >= 400) throw Object.assign(new Error(response.body?.message || `HTTP ${response.status}`), { status: response.status, body: response.body });
          return { response, json() {
            return response?.body ?? null;
          } };
        } catch (cause) {
          const error = new Error(cause?.body?.message || cause?.message || "Discord request failed");
          error.status = cause?.status;
          error.retryAfter = Number(cause?.body?.retry_after) || 0;
          throw error;
        }
      },
      hook(names, transform) {
        const set = new Set(names);
        const jsx = B.api?.react?.jsx;
        if (jsx?.onJsxCreate && jsx?.deleteJsxCreate) {
          for (const name of names) {
            const callback = (_Component, element) => {
              if (!r.active) return;
              r.status[name] = (r.status[name] || 0) + 1;
              try {
                return transform(element, name);
              } catch (error) {
                r.error(`JSX ${name}`, error);
              }
            };
            jsx.onJsxCreate(name, callback);
            r.own(() => jsx.deleteJsxCreate(name, callback));
          }
        }
        r.patch("after", React, "createElement", (args, result) => {
          if (!r.active || !result) return;
          const type = args[0];
          const name = typeof type === "string" ? type : type?.displayName || type?.name || type?.type?.name;
          if (!name || !set.has(name)) return;
          r.status[name] = (r.status[name] || 0) + 1;
          try {
            return transform(result, name) ?? result;
          } catch (error) {
            r.error(`createElement ${name}`, error);
          }
        });
      },
      patchRows(transform) {
        const apply = (value) => {
          try {
            const wasString = typeof value === "string";
            const rows = wasString ? JSON.parse(value) : value;
            const next = transform(rows);
            if (next == null) return value;
            return wasString ? typeof next === "string" ? next : JSON.stringify(next) : next;
          } catch {
            return value;
          }
        };
        const modules = r.RN.NativeModules || {};
        for (const key of Object.keys(modules)) {
          if (typeof modules[key]?.updateRows === "function") {
            r.patch("before", modules[key], "updateRows", (args) => {
              if (args && args[1] != null) args[1] = apply(args[1]);
            });
          }
        }
        const manager = r.byName("RowManager");
        const proto = manager?.prototype || manager;
        if (typeof proto?.generate === "function") {
          r.patch("after", proto, "generate", (_args, row) => apply(row));
        }
      },
      hideSheets() {
        for (const close of [...openSheets.values()]) {
          try {
            close();
          } catch {
          }
        }
        openSheets.clear();
      },
      open(key, Component, props = {}, options = {}) {
        if (!r.active) throw new Error("Plugin stopped");
        const sheets = B.ui?.sheets;
        const ActionSheet = D.ActionSheet || C.ActionSheet;
        if (!sheets?.showSheet || !sheets?.hideSheet || !ActionSheet) throw new Error("Snow bottom-sheet components unavailable");
        const id = `${meta.id}.${key}`;
        openSheets.get(id)?.();
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          if (openSheets.get(id) === close) openSheets.delete(id);
          sheets.hideSheet(id);
        };
        class Boundary extends React.Component {
          state = { error: null };
          static getDerivedStateFromError(error) {
            return { error };
          }
          componentDidCatch(error) {
            r.error("Sheet rendering", error);
          }
          render() {
            if (!this.state.error) return this.props.children;
            const U = ui(r);
            return r.h(U.Page, { title: "Could not display this page", close }, r.h(U.Text, null, this.state.error.message));
          }
        }
        function Page() {
          React.useEffect(() => () => {
            if (openSheets.get(id) === close) openSheets.delete(id);
            closed = true;
          }, []);
          return r.h(ActionSheet, { scrollable: options.scrollable ?? true }, r.h(Boundary, null, r.h(Component, { ...props, close })));
        }
        openSheets.set(id, close);
        try {
          sheets.showSheet(id, Page);
        } catch (error) {
          close();
          throw error;
        }
        return close;
      },
      copy(text) {
        if (!r.active) return;
        const clip = r.common.clipboard || r.find("setString");
        if (!clip?.setString) throw new Error("Clipboard unavailable");
        clip.setString(String(text));
        r.toast("Copied");
      },
      dispose() {
        active = false;
        control.abort();
        for (const id of alerts) {
          try {
            B.ui?.dismissAlert?.(id);
          } catch (e) {
            console.error(`[${meta.name}] alert cleanup`, e?.message);
          }
        }
        alerts.clear();
        for (const abort of requests) abort();
        requests.clear();
        for (const close of [...openSheets.values()]) {
          try {
            close();
          } catch {
          }
        }
        openSheets.clear();
        while (cleanups.length) {
          try {
            cleanups.pop()();
          } catch (e) {
            console.error(`[${meta.name}] cleanup`, e?.message);
          }
        }
        r.changed();
        listeners.clear();
        return r.api.storage.flush();
      }
    };
    return r;
  }
  function ui(r) {
    const { h, C, D, RN, store } = r;
    function Text({ children, muted = false, heading = false, color, ...props }) {
      const Comp = D.Text || C.Text;
      if (Comp) return h(Comp, { variant: heading ? "heading-md/semibold" : "text-md/normal", color: color || (muted ? "text-muted" : "text-normal"), ...props }, children);
      return h(RN.Text, props, children);
    }
    function Button({ text, onPress, disabled, variant = "primary", ...props }) {
      const Comp = D.Button;
      if (Comp) return h(Comp, { text, onPress, disabled, variant, size: "md", ...props });
      return h(RN.Pressable || RN.TouchableOpacity, { onPress, disabled, accessibilityRole: "button", style: { padding: 12 } }, h(Text, null, text));
    }
    function Page({ title, children, close }) {
      const body = [
        title ? h(Text, { key: "title", heading: true, accessibilityRole: "header" }, title) : null,
        children,
        close ? h(Button, { key: "close", text: "Close", variant: "secondary", onPress: close }) : null
      ];
      if (C.SettingsPage) return h(C.SettingsPage, null, ...body);
      return h(RN.View, { style: { padding: 16, gap: 12 } }, ...body);
    }
    function Input({ value, onChange, ...props }) {
      if (D.TextInput) return h(D.TextInput, { value, onChange, ...props });
      if (C.TextInput) return h(C.TextInput, { value, onChange, ...props });
      return h(RN.TextInput, { value, onChangeText: onChange, ...props });
    }
    function Toggle({ setting, label, subLabel, icon }) {
      r.useRefresh();
      const Row = D.TableSwitchRow || C.TableSwitchRow;
      if (!Row) return null;
      return h(Row, {
        label,
        subLabel,
        icon: icon || (C.RowIcon ? h(C.RowIcon, { name: "SettingsIcon" }) : void 0),
        value: !!store[setting],
        onValueChange: (v) => r.set(setting, v)
      });
    }
    function Slider({ value, onValueChange, minimumValue = 0, maximumValue = 1, step, ...props }) {
      const Comp = D.Slider || C.Slider;
      if (Comp) return h(Comp, { value, onValueChange, minimumValue, maximumValue, step, ...props });
      return h(Input, { value: String(value), onChange: (text) => onValueChange(Number(text) || 0), keyboardType: "numeric" });
    }
    return { Text, Button, Page, Input, Toggle, Slider };
  }
  function register(meta, factory) {
    const B = bunny;
    let runtime;
    let instance;
    return definePlugin({
      async start() {
        if (runtime) {
          try {
            await instance?.stop?.();
          } finally {
            await runtime.dispose();
          }
        }
        runtime = createRuntime(B, meta, factory.defaults || {});
        try {
          instance = factory(runtime);
          await instance.start?.();
        } catch (error) {
          runtime.error("Start failed", error);
          await runtime.dispose();
          throw error;
        }
      },
      async stop() {
        try {
          await instance?.stop?.();
        } finally {
          await runtime?.dispose();
          instance = null;
          runtime = null;
        }
      },
      SettingsComponent() {
        return instance?.Settings ? runtime.h(instance.Settings) : null;
      }
    });
  }

  // project:src/settings-section.js
  function registerSection(r, section) {
    const constants = r.find("SETTING_RENDERER_CONFIG");
    const lists = r.find("createList");
    if (!constants || !lists || !r.api.patcher?.before) return false;
    const navigationRef = r.find("getRootNavigationRef");
    const navigation = r.common.NavigationNative;
    const routeName = "MIME_PLUGIN_SETTINGS_PAGE";
    const canNavigate = navigationRef && navigation?.useRoute && navigation?.useNavigation;
    const key = /* @__PURE__ */ Symbol.for("mime.snow.settingsSections.v2");
    let hub = constants[key];
    if (!hub) {
      let CustomPageRenderer = function() {
        const route = navigation.useRoute();
        const nav = navigation.useNavigation();
        r.React.useEffect(() => {
          nav.setOptions({ title: route.params.title, headerShown: route.params.headerShown !== false });
        }, [nav, route.params.title, route.params.headerShown]);
        return route.params.render();
      };
      const descriptor = Object.getOwnPropertyDescriptor(constants, "SETTING_RENDERER_CONFIG");
      if (!descriptor?.configurable) return false;
      const entries = /* @__PURE__ */ new Map();
      let value = constants.SETTING_RENDERER_CONFIG;
      const get = () => {
        const base = descriptor.get ? descriptor.get.call(constants) : value;
        const extra = {};
        if (canNavigate) extra[routeName] = {
          type: "route",
          useTitle: () => "Plugin",
          screen: { route: routeName, getComponent: () => CustomPageRenderer }
        };
        for (const { runtime, section: s } of entries.values()) for (const row of s.items) {
          extra[row.key] = {
            type: "pressable",
            icon: row.icon,
            IconComponent: row.IconComponent || (() => null),
            useTitle: row.title,
            usePredicate: row.usePredicate,
            useTrailing: row.useTrailing,
            withArrow: true,
            onPress: row.onPress || (async () => {
              try {
                const page = await row.render();
                if (!runtime.active) return;
                if (canNavigate) {
                  const nav = navigationRef.getRootNavigationRef();
                  nav.navigate(routeName, {
                    title: row.title(),
                    headerShown: row.headerShown,
                    owner: runtime.meta.id,
                    render: () => runtime.active ? runtime.h(page.default, { close: () => nav.goBack() }) : null
                  });
                } else runtime.open(row.key, page.default, {}, { scrollable: false });
              } catch (error) {
                if (runtime.active) runtime.error("Open settings page", error);
              }
            }),
            ...row.rawTabsConfig
          };
        }
        return { ...base, ...extra };
      };
      Object.defineProperty(constants, "SETTING_RENDERER_CONFIG", {
        configurable: true,
        enumerable: descriptor.enumerable,
        get,
        set: descriptor.set ? (v) => descriptor.set.call(constants, v) : (v) => {
          value = v;
        }
      });
      hub = { entries, close() {
        if (Object.getOwnPropertyDescriptor(constants, "SETTING_RENDERER_CONFIG")?.get === get) {
          Object.defineProperty(constants, "SETTING_RENDERER_CONFIG", descriptor.get ? descriptor : { ...descriptor, value });
        }
        delete constants[key];
      } };
      Object.defineProperty(constants, key, { value: hub, configurable: true });
    }
    const id = Symbol(section.name);
    hub.entries.set(id, { runtime: r, section });
    r.patch("before", lists, "createList", (args) => {
      if (!r.active) return;
      const config = args[0];
      if (!config?.sections?.some((s) => s.settings?.includes("ACCOUNT"))) return;
      const sections = config.sections.map((s) => ({ ...s, settings: s.settings ? [...s.settings] : s.settings }));
      const keys = section.items.map((row) => row.key);
      const existing = sections.find((s) => s.label === section.name);
      if (existing) existing.settings = [.../* @__PURE__ */ new Set([...existing.settings || [], ...keys])];
      else sections.unshift({ label: section.name, title: section.name, settings: keys });
      args[0] = { ...config, sections };
    });
    r.own(() => {
      if (canNavigate) {
        const nav = navigationRef.getRootNavigationRef();
        const current = nav?.getCurrentRoute?.();
        if (current?.name === routeName && current.params?.owner === r.meta.id) nav.goBack();
      }
      hub.entries.delete(id);
      if (!hub.entries.size) hub.close();
    });
    return true;
  }

  // project:src/action-sheet.js
  function mapTree(React, node, transform) {
    const replacement = transform(node);
    if (replacement !== void 0) return replacement;
    if (Array.isArray(node)) return node.map((child) => mapTree(React, child, transform));
    if (!React.isValidElement(node) || node.props.children == null) return node;
    return React.cloneElement(node, {}, mapTree(React, node.props.children, transform));
  }
  function appendAction(r, tree, item) {
    let inserted = false;
    const name = (node) => node?.type?.displayName || node?.type?.name || node?.type?.type?.name;
    const result = mapTree(r.React, tree, (node) => {
      if (inserted || !Array.isArray(node)) return;
      const sample = node.find((n) => name(n) === "ButtonRow" || name(n) === "ActionSheetRow");
      if (!sample || node.some((n) => n?.key === item.key)) return;
      inserted = true;
      const Row = name(sample) === "ButtonRow" ? r.D.Forms?.FormRow || r.C.Forms?.FormRow || sample.type : sample.type;
      return [...node, r.h(Row, { key: item.key, label: item.label, onPress: item.onPress, ...item.icon ? { icon: item.icon, leading: item.icon } : {} })];
    });
    return inserted ? result : tree;
  }
  function patchLazySheet(r, getItem) {
    const sheets = r.find("openLazy", "hideActionSheet");
    if (!sheets || !r.api.patcher?.before) return false;
    return r.patch("before", sheets, "openLazy", (args) => {
      const [pending, key, props] = args;
      const item = getItem(key, props);
      if (!item || !pending?.then) return;
      args[0] = pending.then((module) => {
        if (!r.active || typeof module?.default !== "function" || module.default.prototype?.isReactComponent) return module;
        const Original = module.default;
        function WithAction(screenProps) {
          const tree = Original(screenProps);
          const current = r.active ? getItem(key, screenProps?.message || screenProps?.channel ? screenProps : props) : null;
          if (!current) return tree;
          return appendAction(r, tree, { ...current, onPress: () => {
            if (!r.active) return;
            sheets.hideActionSheet();
            Promise.resolve().then(() => current.onPress()).catch((error) => {
              if (r.active) r.error(current.label, error);
            });
          } });
        }
        return { ...module, default: WithAction };
      });
    });
  }

  // project:src/plugins/nighty-icon.js
  var blueIcon = "data:image/png;base64,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";
  var grayIcon = "data:image/png;base64,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";

  // project:src/plugins/nighty-session.js
  function nightyOrigin(value) {
    try {
      const url = new URL(String(value).trim());
      if (url.protocol !== "https:" || url.username || url.password || /(^|\.)discord(?:app)?\.(?:com|net)$/i.test(url.hostname)) return "";
      return url.origin;
    } catch {
      return "";
    }
  }
  function cleanNightyToken(value) {
    return typeof value === "string" && value.length >= 8 && value.length <= 4096 && /^[\w.~+/-]+=*$/.test(value) ? value : "";
  }
  function nightyBootstrap(config) {
    if (window.top !== window.self || location.origin !== config.origin || window.__mimeNightySessionV2) return true;
    window.__mimeNightySessionV2 = true;
    const valid = (value) => typeof value === "string" && value.length >= 8 && value.length <= 4096 && /^[\w.~+/-]+=*$/.test(value) ? value : "";
    let last = "", blocked = !!config.loggedOut, revision = 0, timer;
    try {
      blocked ||= sessionStorage.getItem("__mimeNightyLoggedOut") === "1";
    } catch {
    }
    const emit = (type, token = "") => {
      if (location.origin === config.origin) window.ReactNativeWebView?.postMessage(JSON.stringify({ type, origin: config.origin, channel: config.channel, token }));
    };
    const readLocal = () => {
      try {
        return valid(localStorage.getItem("access_token"));
      } catch {
        return "";
      }
    };
    const readCookie = () => {
      try {
        const entry = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("access_token="));
        return entry ? valid(decodeURIComponent(entry.slice(13))) : "";
      } catch {
        return "";
      }
    };
    const publish = (token) => {
      token = valid(token);
      if (!token || blocked || token === last) return;
      last = token;
      emit("NIGHTY_SESSION_SAVE", token);
    };
    const clear = (erase = true) => {
      blocked = true;
      revision += 1;
      last = "";
      try {
        sessionStorage.setItem("__mimeNightyLoggedOut", "1");
      } catch {
      }
      if (erase) {
        try {
          localStorage.removeItem("access_token");
        } catch {
        }
        try {
          document.cookie = "access_token=; Path=/; Max-Age=0; SameSite=Lax; Secure";
        } catch {
        }
      }
      emit("NIGHTY_SESSION_CLEAR");
    };
    const accept = (token) => {
      token = valid(token);
      if (!token) return;
      blocked = false;
      revision += 1;
      try {
        sessionStorage.removeItem("__mimeNightyLoggedOut");
      } catch {
      }
      try {
        localStorage.setItem("access_token", token);
      } catch {
      }
      publish(token);
    };
    if (blocked) {
      try {
        localStorage.removeItem("access_token");
      } catch {
      }
      try {
        document.cookie = "access_token=; Path=/; Max-Age=0; SameSite=Lax; Secure";
      } catch {
      }
    }
    if (!blocked && !readLocal() && !readCookie() && valid(config.token)) {
      try {
        localStorage.setItem("access_token", config.token);
      } catch {
      }
      try {
        document.cookie = "access_token=" + encodeURIComponent(config.token) + "; Path=/; Max-Age=2592000; SameSite=Lax; Secure";
      } catch {
      }
    }
    last = readLocal() || readCookie();
    if (last && !blocked) emit("NIGHTY_SESSION_SAVE", last);
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
        if (this === localStorage && String(key) === "access_token") {
          if (valid(String(value))) {
            blocked = false;
            revision += 1;
            try {
              sessionStorage.removeItem("__mimeNightyLoggedOut");
            } catch {
            }
            publish(String(value));
          } else clear();
        }
        return result;
      };
      proto.removeItem = function(key) {
        const result = remove.apply(this, arguments);
        if (this === localStorage && String(key) === "access_token" && !blocked) clear();
        return result;
      };
      proto.clear = function() {
        const result = empty.apply(this, arguments);
        if (this === localStorage && !blocked) clear();
        return result;
      };
    } catch {
    }
    const endpoint = (value) => {
      try {
        const url = new URL(typeof value === "string" ? value : value?.url || "", location.href);
        return url.origin === config.origin ? url.pathname : "";
      } catch {
        return "";
      }
    };
    const logoutPath = (path) => /\/(?:logout|log-out|signout|sign-out)(?:\/|$)/i.test(path);
    const loginPath = (path) => /\/(?:login|log-in|signin|sign-in)(?:\/|$)/i.test(path);
    const responseToken = (path, data, started) => {
      if (revision !== started || blocked && !loginPath(path)) return;
      accept(data?.access_token);
    };
    if (typeof window.fetch === "function") {
      const original = window.fetch;
      window.fetch = function(input) {
        const path = endpoint(input);
        if (logoutPath(path)) clear(false);
        const started = revision;
        return original.apply(this, arguments).then((response) => {
          if (logoutPath(path)) clear();
          if (path && !logoutPath(path) && (!response.url || endpoint(response.url)) && response.ok && response.clone) response.clone().json().then((data) => responseToken(path, data, started)).catch(() => {
          });
          return response;
        }, (error) => {
          if (logoutPath(path)) clear();
          throw error;
        });
      };
    }
    if (window.XMLHttpRequest?.prototype) {
      const proto = window.XMLHttpRequest.prototype;
      const open = proto.open, send = proto.send, paths = /* @__PURE__ */ new WeakMap();
      proto.open = function(method, url) {
        paths.set(this, endpoint(url));
        return open.apply(this, arguments);
      };
      proto.send = function() {
        const path = paths.get(this) || "";
        if (logoutPath(path)) clear(false);
        const started = revision;
        if (logoutPath(path)) this.addEventListener("loadend", () => clear(), { once: true });
        else if (path) this.addEventListener("load", () => {
          if (this.status < 200 || this.status >= 300 || this.responseURL && !endpoint(this.responseURL)) return;
          try {
            responseToken(path, this.responseType === "json" ? this.response : JSON.parse(this.responseText), started);
          } catch {
          }
        }, { once: true });
        return send.apply(this, arguments);
      };
    }
    window.addEventListener("storage", (event) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === null || event.key === "access_token" && !valid(event.newValue)) clear();
      else if (event.key === "access_token") accept(event.newValue);
    });
    document.addEventListener("click", (event) => {
      const link = event.target?.closest?.("a[href]");
      if (link && logoutPath(endpoint(link.href))) clear(false);
    }, true);
    document.addEventListener("submit", (event) => {
      if (logoutPath(endpoint(event.target?.action))) clear(false);
    }, true);
    const start = () => {
      if (!timer) timer = setInterval(poll, 1e3);
    };
    window.addEventListener("pagehide", () => {
      poll();
      clearInterval(timer);
      timer = void 0;
    });
    window.addEventListener("pageshow", start);
    start();
    return true;
  }
  function createNightySession(r, url) {
    const origin = nightyOrigin(url);
    const channel = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const records = () => r.store.nightySessionsV2 && typeof r.store.nightySessionsV2 === "object" && !Array.isArray(r.store.nightySessionsV2) ? r.store.nightySessionsV2 : {};
    let disposed = false, pending = Promise.resolve();
    const script = () => {
      const record = records()[origin];
      const config = { origin, channel, token: cleanNightyToken(record?.token), loggedOut: record?.loggedOut === true };
      return origin ? `(${nightyBootstrap.toString()})(${JSON.stringify(config)}); true;` : "true;";
    };
    function onMessage(event) {
      if (disposed || !r.active || !origin || nightyOrigin(r.store.url) !== origin) return;
      const native = event?.nativeEvent;
      if (nightyOrigin(native?.url) !== origin || typeof native?.data !== "string" || native.data.length > 8192) return;
      let data;
      try {
        data = JSON.parse(native.data);
      } catch {
        return;
      }
      if (data?.origin !== origin || data.channel !== channel) return;
      const clear = data.type === "NIGHTY_SESSION_CLEAR", token = cleanNightyToken(data.token);
      if (!clear && (data.type !== "NIGHTY_SESSION_SAVE" || !token)) return;
      const current = records();
      if (!clear && current[origin]?.token === token) return;
      r.store.nightySessionsV2 = { ...current, [origin]: clear ? { loggedOut: true, updatedAt: Date.now() } : { token, updatedAt: Date.now() } };
      if (r.store.sessions && typeof r.store.sessions === "object") {
        const legacy = { ...r.store.sessions };
        delete legacy[new URL(origin).host];
        r.store.sessions = legacy;
      }
      r.changed();
      pending = pending.catch(() => {
      }).then(() => r.api.storage.flush()).catch(() => {
        if (r.active) r.error("Nighty session", new Error("Could not persist the Nighty session. Sign in again if necessary."));
      });
    }
    return { origin, get script() {
      return script();
    }, onMessage, dispose() {
      disposed = true;
      return pending;
    } };
  }

  // project:src/plugins/nighty-tab.js
  function pageUrl(value) {
    try {
      const url = new URL(String(value).trim());
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  }
  function canDownload(settings, message) {
    return !!settings.scriptUtils && typeof settings.nightyPrefix === "string" && Array.from(settings.nightyPrefix).length === 1 && !!settings.nightyPrefix.trim() && !!message?.id && !!messageChannelId(message) && !!message.attachments?.length;
  }
  function messageChannelId(message) {
    return message?.getChannelId?.() || message?.channel_id || message?.channelId;
  }
  function iconHint(node) {
    const props = node?.props || {};
    const bits = [props.name, typeof props.icon === "string" ? props.icon : ""];
    const kids = Array.isArray(props.children) ? props.children : props.children ? [props.children] : [];
    for (const child of kids) {
      if (typeof child?.props?.name === "string") bits.push(child.props.name);
      const type = child?.type;
      if (typeof type === "function") bits.push(type.displayName || type.name || "");
    }
    return bits.filter(Boolean).join(" ");
  }
  var ACTION_KEYS = ["actions", "buttons", "items", "headerActions", "trailingActions", "toolbarItems"];
  var SETTINGS_MESSAGE_KEYS = ["SETTINGS", "USER_SETTINGS", "SETTINGS_TITLE", "OPEN_SETTINGS", "USER_SETTINGS_BUTTON"];
  var OTHER_MESSAGE_KEYS = ["QUESTS", "SHOP", "NITRO", "COLLECTIBLES", "COLLECTIBLES_SHOP", "QUEST_HOME"];
  function textOf(value, depth = 0) {
    if (value == null || depth > 2) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (typeof value === "function") return value.displayName || value.name || "";
    if (typeof value === "object") return ["message", "defaultMessage", "id", "displayName", "name"].map((key) => textOf(value[key], depth + 1)).filter(Boolean).join(" ");
    return "";
  }
  function recordText(record) {
    if (!record || typeof record !== "object") return "";
    return ["label", "accessibilityLabel", "accessibilityHint", "aria-label", "testID", "nativeID", "id", "key", "name", "route", "screen", "icon", "Icon", "IconComponent"].map((key) => textOf(record[key])).filter(Boolean).join(" ");
  }
  var settingsNeedles = [];
  var otherNeedles = [];
  function rememberMessages(messages) {
    if (!messages || typeof messages !== "object") return;
    const take = (keys, bucket) => {
      for (const key of keys) {
        const value = messages[key];
        if (typeof value === "string" && value.length >= 2 && value.length <= 32 && !bucket.includes(value)) bucket.push(value);
      }
    };
    take(SETTINGS_MESSAGE_KEYS, settingsNeedles);
    take(OTHER_MESSAGE_KEYS, otherNeedles);
  }
  function isSettingsText(text) {
    if (!text || /notification/i.test(text)) return false;
    if (/settings?|SettingsIcon|GearIcon|CogIcon|USER_SETTINGS|\b(gear|cog)\b/i.test(text)) return true;
    return settingsNeedles.some((word) => text.includes(word));
  }
  function isOtherText(text) {
    if (!text) return false;
    if (/quest|shop|collectible|nitro|QuestIcon|ShopIcon|NitroIcon|CollectiblesIcon/i.test(text)) return true;
    return otherNeedles.some((word) => text.includes(word));
  }
  function pressProps(record) {
    if (!record || typeof record !== "object" || record.subLabel || record.trailing) return false;
    if (typeof record.label === "string" && record.label.length > 40) return false;
    return typeof record.onPress === "function" || typeof record.onPressOut === "function";
  }
  function nodeText(node) {
    const props = node?.props;
    if (!props) return "";
    return ["accessibilityLabel", "accessibilityHint", "aria-label", "testID", "nativeID", "label", "name", "route", "screen", "id"].map((key) => textOf(props[key])).concat(iconHint(node)).filter(Boolean).join(" ");
  }
  function isIconControl(node) {
    return pressProps(node?.props);
  }
  function isSettingsControl(node) {
    return isIconControl(node) && isSettingsText(nodeText(node));
  }
  function isQuestOrShopControl(node) {
    return isIconControl(node) && isOtherText(nodeText(node));
  }
  function plainKind(item) {
    if (!pressProps(item) || item.props) return "";
    const text = recordText(item);
    if (isSettingsText(text)) return "settings";
    if (isOtherText(text)) return "other";
    return "";
  }
  function controlKind(node) {
    if (isSettingsControl(node)) return "settings";
    if (isQuestOrShopControl(node)) return "other";
    const inner = node?.props?.children;
    const list = Array.isArray(inner) ? inner.filter(Boolean) : inner ? [inner] : [];
    if (list.length !== 1) return "";
    if (isSettingsControl(list[0])) return "settings-wrap";
    if (isQuestOrShopControl(list[0])) return "other-wrap";
    return "";
  }
  function insertPlainAction(list, makeButton) {
    if (!Array.isArray(list) || list.length < 2 || list.length > 8) return list;
    if (list.some((item) => item?.key === "mime-nighty-profile-button" || item?.id === "mime-nighty-profile-button")) return list;
    const kinds = list.map(plainKind);
    const index = kinds.indexOf("settings");
    if (index < 0 || !kinds.includes("other")) return list;
    const next = list.slice();
    next.splice(index + 1, 0, makeButton(list[index]));
    return next;
  }
  function insertNightySlot(React, element, makeButton) {
    const children = element?.props?.children;
    const list = Array.isArray(children) ? children.filter(Boolean) : null;
    if (!list || list.length < 2 || list.length > 8) return element;
    if (list.some((node2) => node2?.props?.testID === "mime-nighty-profile-button")) return element;
    const kinds = list.map(controlKind);
    const index = kinds.findIndex((kind) => kind === "settings" || kind === "settings-wrap");
    if (index < 0 || !kinds.some((kind) => kind === "other" || kind === "other-wrap")) return element;
    const node = list[index];
    const sample = kinds[index] === "settings" ? node : Array.isArray(node.props.children) ? node.props.children.filter(Boolean)[0] : node.props.children;
    const added = makeButton(sample);
    if (!added) return element;
    const next = list.slice();
    next.splice(index + 1, 0, added);
    return React.cloneElement(element, {}, ...next);
  }
  function NightyTab(r) {
    const { h, React, RN, store } = r;
    const { Page, Text, Button, Input, Toggle } = ui(r);
    const iconUrl = () => store.iconType === "custom" ? pageUrl(store.customIconUrl) : store.iconType === "grayscale" ? grayIcon : blueIcon;
    function Icon() {
      r.useRefresh();
      const uri = iconUrl();
      return uri ? h(
        RN.View,
        { style: { width: 24, height: 24, alignItems: "center", justifyContent: "center" } },
        h(RN.Image, { source: { uri }, resizeMode: "contain", style: { width: 18, height: 18 }, accessibilityIgnoresInvertColors: true })
      ) : null;
    }
    const sending = /* @__PURE__ */ new Set();
    async function download(message) {
      if (!r.active || !canDownload(store, message) || sending.has(message.id)) return;
      sending.add(message.id);
      try {
        const module = r.find("HTTP", "get", "post", "put", "patch", "del") || r.find("get", "post", "put", "del");
        const rest = module?.HTTP || module;
        if (typeof rest?.post !== "function") throw new Error("Discord message API unavailable");
        const channelId = messageChannelId(message);
        await rest.post({ url: `/channels/${channelId}/messages`, body: {
          content: `${store.nightyPrefix}dls`,
          message_reference: { message_id: message.id, channel_id: channelId, ...message.guild_id ? { guild_id: message.guild_id } : {} },
          allowed_mentions: { parse: [], replied_user: false }
        } });
      } finally {
        sending.delete(message.id);
      }
    }
    function readInset(edge) {
      try {
        const mod = r.find("initialWindowMetrics") || r.find("useSafeAreaInsets") || {};
        const insets = mod.initialWindowMetrics?.insets || mod.insets;
        const value = insets?.[edge];
        if (typeof value === "number" && value > 0 && value < 80) return Math.round(value);
      } catch {
      }
      return 0;
    }
    const openSessions = /* @__PURE__ */ new Set();
    r.own(() => {
      for (const session of openSessions) session.dispose();
      openSessions.clear();
    });
    function NightyPage() {
      r.useRefresh();
      const src = pageUrl(store.url);
      const WebView = r.find("WebView")?.WebView || r.byName("WebView");
      const [error, setError] = React.useState("");
      const session = React.useMemo(() => createNightySession(r, src), [src]);
      React.useEffect(() => {
        openSessions.add(session);
        return () => {
          openSessions.delete(session);
          session.dispose();
        };
      }, [session]);
      if (!r.active) return null;
      const frame = { flex: 1, width: "100%", paddingBottom: readInset("bottom") };
      const allow = (req) => {
        const url = req?.url || "";
        return !url || url === "about:blank" || !!session.origin && nightyOrigin(url) === session.origin;
      };
      return h(
        RN.View,
        { style: frame },
        !src || !session.origin ? h(Text, null, "Set an HTTPS Nighty URL in settings. Discord domains are not allowed.") : !WebView ? h(Text, null, "WebView is unavailable in this Snow build.") : h(WebView, {
          key: src,
          source: { uri: src },
          style: { flex: 1, width: "100%" },
          originWhitelist: ["http://*", "https://*"],
          javaScriptEnabled: true,
          domStorageEnabled: true,
          sharedCookiesEnabled: false,
          thirdPartyCookiesEnabled: false,
          incognito: false,
          startInLoadingState: true,
          injectedJavaScriptBeforeContentLoaded: session.script,
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly: true,
          injectedJavaScriptForMainFrameOnly: true,
          onMessage: session.onMessage,
          onShouldStartLoadWithRequest: allow,
          onError: () => setError("Could not load Nighty."),
          onHttpError: (event) => setError(`Nighty returned HTTP ${event.nativeEvent?.statusCode}.`),
          onLoad: () => setError("")
        }),
        error ? h(Text, null, error) : null
      );
    }
    function Settings({ close }) {
      r.useRefresh();
      return h(
        Page,
        { title: "Nighty Tab", close },
        h(Text, null, "URL"),
        h(Input, { value: store.url, placeholder: "https://", autoCapitalize: "none", onChange: (v) => r.set("url", v) }),
        store.url && !nightyOrigin(store.url) ? h(Text, null, "Enter an HTTPS Nighty URL without embedded credentials. Discord domains are not allowed.") : null,
        h(Text, { muted: true }, "Nighty sessions are saved locally in plugin storage, not an encrypted credential vault. External-site navigation is blocked."),
        h(Button, { text: "Open Nighty", onPress: () => {
          if (!openNighty()) openSheet();
        } }),
        h(Toggle, { setting: "showNightyButton", label: "Profile Nighty button", subLabel: "Adds a Nighty button beside Settings on your profile. It uses the same icon as the Nighty settings row." }),
        h(Toggle, { setting: "scriptUtils", label: "Script Utils functions", subLabel: "Download Script replies to an attachment with your prefix followed by dls." }),
        h(Text, null, "Nighty prefix (one character)"),
        h(Input, { value: store.nightyPrefix, onChange: (v) => r.set("nightyPrefix", v), autoCapitalize: "none", placeholder: "." }),
        ...["blue", "grayscale", "custom"].map((style) => h(Button, { key: style, text: `${store.iconType === style ? "\u2713 " : ""}${style} icon`, onPress: () => r.set("iconType", style) })),
        store.iconType === "custom" ? h(Input, { value: store.customIconUrl, placeholder: "https:// image URL", autoCapitalize: "none", onChange: (v) => r.set("customIconUrl", v) }) : null,
        h(Icon),
        h(Text, { muted: true }, `Settings entry: ${r.status.settingsEntry ? "registered" : "unavailable"} \xB7 Message menu: ${r.status.messageMenu ? "registered" : "unavailable"} \xB7 Profile button: ${store.showNightyButton ? r.status.profileButton === "added" ? "added beside Settings" : "watching" : "off"}`)
      );
    }
    function screenNavigator() {
      const found = r.byName("Navigator", true) || r.byName("Navigator") || r.find("Navigator");
      if (typeof found === "function") return found;
      if (typeof found?.Navigator === "function") return found.Navigator;
      if (typeof found?.default === "function") return found.default;
      return null;
    }
    function openNighty() {
      if (!r.active) return false;
      const navigation = r.common.navigation || r.find("push", "pushLazy", "pop");
      if (typeof navigation?.push !== "function") return false;
      const Navigator = screenNavigator();
      const close = () => navigation.pop?.();
      const headerLeft = discordClose(close) || (() => closeMark(close));
      function Screen() {
        if (Navigator) return h(Navigator, {
          initialRouteName: "Nighty",
          goBackOnBackPress: true,
          screens: {
            Nighty: {
              title: "Nighty",
              headerBackVisible: false,
              headerLeft,
              render: () => r.active ? h(NightyPage, { close }) : null
            }
          }
        });
        return h(RN.View, { style: { flex: 1, width: "100%" } }, renderClose(close), h(NightyPage, { close }));
      }
      Screen.displayName = "Nighty";
      try {
        navigation.push(Screen);
        return true;
      } catch (error) {
        if (r.active) r.error("Open Nighty", error);
        return false;
      }
    }
    function openSheet() {
      try {
        r.open("nighty", NightyPage, {}, { scrollable: false });
      } catch (error) {
        if (r.active) r.error("Open Nighty", error);
      }
    }
    function press() {
      return () => {
        if (r.active && store.showNightyButton && !openNighty()) openSheet();
      };
    }
    function toolbarIcon() {
      const uri = iconUrl();
      if (!uri) return null;
      return h(RN.Image, {
        source: { uri },
        resizeMode: "contain",
        fadeDuration: 0,
        accessibilityIgnoresInvertColors: true,
        style: { width: 48, height: 32 }
      });
    }
    function profileImage() {
      const uri = iconUrl();
      if (!uri) return null;
      return h(
        RN.View,
        { style: { width: 52, height: 40, alignItems: "center", justifyContent: "center", overflow: "visible" } },
        h(RN.Image, {
          source: { uri },
          resizeMode: "contain",
          fadeDuration: 0,
          accessibilityIgnoresInvertColors: true,
          style: { width: 48, height: 32 }
        })
      );
    }
    function discordClose(onClose) {
      const module = r.find("getRenderCloseButton") || r.find("getHeaderCloseButton");
      const render = module?.getRenderCloseButton || module?.getHeaderCloseButton;
      if (typeof render !== "function") return null;
      try {
        return render(onClose) || null;
      } catch (error) {
        if (r.active) r.error("Nighty close button", error);
        return null;
      }
    }
    function closeMark(onClose) {
      return h(RN.Pressable || RN.TouchableOpacity, {
        accessibilityLabel: "Close",
        accessibilityRole: "button",
        onPress: onClose,
        hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
        style: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }
      }, h(RN.Text, { style: { color: "#FFFFFF", fontSize: 22, lineHeight: 24 } }, "\u2715"));
    }
    function renderClose(onClose) {
      const control = discordClose(onClose);
      if (typeof control === "function") return h(control);
      return control || closeMark(onClose);
    }
    function NightyProfileButton({ sample }) {
      r.useRefresh();
      const [open, setOpen] = React.useState(false);
      const Modal = RN.Modal;
      const close = () => setOpen(false);
      return h(
        RN.Pressable || RN.TouchableOpacity,
        {
          accessibilityLabel: "Nighty",
          accessibilityHint: "Open Nighty",
          accessibilityRole: "button",
          testID: "mime-nighty-profile-button",
          hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
          onPress: () => {
            if (!r.active || !store.showNightyButton) return;
            if (!openNighty()) setOpen(true);
          },
          style: { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "visible" }
        },
        profileImage(),
        open && Modal ? h(Modal, {
          visible: true,
          animationType: "slide",
          presentationStyle: "fullScreen",
          statusBarTranslucent: true,
          onRequestClose: close
        }, h(
          RN.View,
          { style: { flex: 1, width: "100%", paddingTop: readInset("top") } },
          renderClose(close),
          h(NightyPage, { close })
        )) : null
      );
    }
    function nightyControl(sample) {
      return h(NightyProfileButton, { key: "mime-nighty-profile-button", sample });
    }
    function nightyRecord(sample) {
      const image = toolbarIcon();
      const record = sample && typeof sample === "object" ? { ...sample } : {};
      for (const key of Object.keys(record)) {
        if (typeof record[key] === "string" && isSettingsText(record[key])) record[key] = "Nighty";
      }
      record.key = "mime-nighty-profile-button";
      record.id = "mime-nighty-profile-button";
      record.label = "Nighty";
      record.text = "Nighty";
      record.accessibilityLabel = "Nighty";
      record.accessibilityHint = "Open Nighty";
      record.IconComponent = Icon;
      record.icon = typeof sample?.icon === "function" ? Icon : image;
      record.onPress = press();
      return record;
    }
    function applyToolbar(element) {
      if (!r.active || !store.showNightyButton || !element?.props) return element;
      const slotted = insertNightySlot(r.React, element, nightyControl);
      if (slotted !== element) {
        r.status.profileButton = "added";
        return slotted;
      }
      let changed = false;
      const props = {};
      for (const key of ACTION_KEYS) {
        const next = insertPlainAction(element.props[key], nightyRecord);
        if (next !== element.props[key]) {
          props[key] = next;
          changed = true;
        }
      }
      if (!changed) return element;
      r.status.profileButton = "added";
      return r.React.cloneElement(element, props);
    }
    const watched = /* @__PURE__ */ new Set();
    function watch(parent, key) {
      const fn = parent?.[key];
      if (typeof fn !== "function" || watched.has(fn)) return false;
      watched.add(fn);
      return r.patch("after", parent, key, (_args, result) => {
        const next = applyToolbar(result);
        return next === result ? void 0 : next;
      });
    }
    return { Settings, NightyPage, download, start() {
      r.status.settingsEntry = registerSection(r, { name: "Nighty", items: [{ key: "MIME_NIGHTY", title: () => "Nighty", headerShown: false, IconComponent: Icon, render: async () => ({ default: NightyPage }) }] });
      r.status.messageMenu = patchLazySheet(r, (key, props) => key === "MessageLongPressActionSheet" && canDownload(store, props?.message) ? { key: "mime-nighty-download", label: "Download Script", icon: h(Icon), onPress: () => download(props.message) } : null);
      rememberMessages(r.common?.i18n?.Messages || r.find("Messages")?.Messages);
      const patched = watch(React, "createElement");
      for (const key of ["jsx", "jsxs"]) watch(React, key);
      const metro = r.B.metro;
      const factories = [r.B._jsx, r.host?._jsx];
      try {
        const found = metro?.findByPropsAll?.("jsx", "jsxs") || [];
        factories.push(...found, metro?.findByProps?.("jsx", "jsxs"));
      } catch {
      }
      for (const factory of factories) {
        watch(factory, "jsx");
        watch(factory, "jsxs");
      }
      r.status.profileButton = patched === false ? "unavailable" : r.status.profileButton === "replaced" ? "replaced" : "patched";
    } };
  }
  NightyTab.defaults = { url: "", scriptUtils: false, nightyPrefix: ".", iconType: "blue", customIconUrl: "", showNightyButton: true, sessions: {}, nightySessionsV2: {} };

  // NightyTab.entry.js
  var NightyTab_entry_default = register({ "id": "mime.nightytab", "name": "Nighty Tab", "description": "Nighty in mobile settings, with an optional profile-bar button and Download Script replies.", "version": "1.7.1-dev.1", "authors": [{ "name": "Mime | N0_.q3", "id": "957164619061932045" }, { "name": "rico | wkcp", "id": "1361736124858630274" }], "license": "GPL-3.0-or-later", "source": "https://github.com/xMimiez/Snow-Plugins/tree/dev/NightyTab" }, NightyTab);
  return __toCommonJS(NightyTab_entry_exports);
})();
