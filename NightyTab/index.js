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

  // Embedded Nighty logo asset.
  var nightyBlueAsset = "data:image/png;base64,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";
  var nightyGrayAsset = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAQCAYAAAAMJL+VAAADTElEQVR4AWSUWSt3URTGn33Mc2SehyRSiijChXIhPoJP44oPYbjlzoULCZEQkhsiZChzpszjec9vHf83ve/p7PbZa6+1nmc9e+3jZWVl+f+O7u5uf3h42J+cnPSnpqb82dlZf3p62h8dHfV7enrMPzs72+bfsZmZmX5+fr4/NDTk9/X1+Xl5eb6nn8fzws+Kigp1dnbq8vJSGxsben5+1sfHhz4/P5Wbm6ve3l5lZGTo+/tbzrmfaIl455xaWloUgKijo0NdXV0KswZuBCQkJKiurk6np6c6OzvTwcGBTk5O9Pj4qIeHB11dXSk2NlYlJSWW3DkXRMq+iU9NTVV7e7uROzw8VGtrawjgXOhYXFyswsJCxcXFKSUlRUlJSdra2tLt7a1VAoiChwqCyRL/nuvr6xUdHa2npyd9fX0pKioqBPB9XzExMWpoaDCGOCUnJxuT1dVVk+f9/d2kginAJCbOOWdy5eTkqK2tTfi9vLyYDYkD6Tx8VVNTo7KyMgOi1GBDm5uburm5scRvb296fX0VM1KSnEDnHJMlj4+PN19ir6+vNTMzIw9HNpqamiw5axLgcH5+boyQxrmQKSCUTpXOhbbS0lJVVlaaNCRHDSrnLA2gtrZWONEtBNMx8/PzxgbGd3d3f/VGWwiRhG/8OVhsxGG/v78XAJD1MDQ3N9uBUCvs9/b2xHDOmf5Uw55z4ZomoJuwQY7GoDLWjIWFBes6wL3GxkZjD5sIi6WlJRl6cDecc3YOrGFIlQA456zbiGePSpHn6OjI7g82GsKDPagYANjZ2RFOERszJTvn7DLhl5iYaO1YXV2t9PR0ISFs2VtcXDRpAVPweOXl5daztB4M19bWbE1AsG8vCWBIAtqQKoqKilRVVSXAI/Jsb2/b5SQ57An2+EhLSxMD5miPA2AkxIkuioCQjIvEpaLiSM9jW15eNnLEORe2r0evFhQU2GEGPzTTPuIQmflVHB8fm0RUwHlxyDQIIFS/srKii4sL6zbiIMbwJiYmxKnv7+9rd3f3PweckARt2Ucq1gyAkGhubk7r6+sWiyLERIYHo/7+fg0MDJjtNzqGyJpWHR8f18jIiILfsQYHBxX80jU2NmY3nsT4OhdKQyzjDwAAAP//JpRgGAAAAAZJREFUAwCqHzEP1SxsYQAAAABJRU5ErkJggg==";

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
    const iconUrl = () => store.iconType === "custom" ? pageUrl(store.customIconUrl) : nightyBlueAsset;
    const iconTint = () => store.iconType === "white" || store.iconType === "grayscale" ? "#F2F3F5" : void 0;
    const selectedIconSize = 28;
    const colors = { background: "#111214", surface: "#1E1F22", surfacePressed: "#26272B", border: "#2B2D31", text: "#F2F3F5", muted: "#B5BAC1", accent: "#5865F2", danger: "#F23F43" };
    function Icon() {
      r.useRefresh();
      const uri = iconUrl();
      return uri ? h(
        RN.View,
        { style: { width: selectedIconSize, height: selectedIconSize, alignItems: "center", justifyContent: "center" } },
        h(RN.Image, { source: { uri }, resizeMode: "contain", style: { width: selectedIconSize, height: selectedIconSize, ...iconTint() ? { tintColor: iconTint() } : {} }, accessibilityIgnoresInvertColors: true })
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
    function pageHost() {
        try {
            const url = new URL(String(store.url).trim());
            return url.protocol === 'https:' && !url.username && !url.password && !/(^|\.)discord(?:app)?\.(?:com|net)$/i.test(url.hostname) ? url.origin : '';
        } catch { return ''; }
    }
    function cleanToken(value) {
      if (typeof value !== "string") return "";
      const token = value.trim();
      if (token.length < 8 || token.length > 4096 || !/^[\w.~+/-]+=*$/.test(token)) return "";
      return token;
    }
    function sessionToken() {
      const host = pageHost();
      if (!host) return "";
      const active = cleanToken(store.sessionToken);
      if (store.sessionHost === host && active) return active;
      const legacy = cleanToken(store.sessions?.[host]);
      return legacy || "";
    }
    function sessionScript(token) {
        return '(' + "function(config) {\n    if (!config.origin || window.top !== window.self || location.origin !== config.origin || window.__mimeNightyCookieV3) return true;\n    window.__mimeNightyCookieV3 = true;\n    const valid = value => typeof value === 'string' && value.length >= 8 && value.length <= 4096 && /^[\\w.~+/-]+=*$/.test(value) ? value : '';\n    let blocked = false, last = '', lastLocal = '', lastCookie = '', revision = 0, timer;\n    try { blocked = sessionStorage.getItem('__mimeNightyLogout') === '1'; } catch {}\n    const emit = (token = '', logout = false) => window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'NIGHTY_TOKEN', origin: config.origin, token, logout }));\n    const local = () => { try { return valid(localStorage.getItem('access_token')); } catch { return ''; } };\n    const cookie = () => { try { const value = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith('access_token=')); return value ? valid(decodeURIComponent(value.slice(13))) : ''; } catch { return ''; } };\n    const setCookie = value => { try { document.cookie = 'access_token=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + (value ? '2592000' : '0') + '; SameSite=Lax; Secure'; } catch {} };\n    const clear = (erase = true) => {\n        blocked = true; last = ''; revision += 1;\n        try { sessionStorage.setItem('__mimeNightyLogout', '1'); } catch {}\n        if (erase) { try { localStorage.removeItem('access_token'); } catch {} setCookie(''); }\n        emit('', true);\n    };\n    const save = value => {\n        value = valid(value);\n        if (!value) return;\n        blocked = false; revision += 1;\n        try { sessionStorage.removeItem('__mimeNightyLogout'); } catch {}\n        try { if (local() !== value) localStorage.setItem('access_token', value); } catch {}\n        if (cookie() !== value) setCookie(value);\n        lastLocal = local(); lastCookie = cookie();\n        if (last !== value) { last = value; emit(value); }\n    };\n    if (blocked) clear();\n    else save(local() || cookie() || valid(config.token));\n    try {\n        const proto = Object.getPrototypeOf(localStorage), set = proto.setItem, remove = proto.removeItem, empty = proto.clear;\n        proto.setItem = function(key, value) { const result = set.apply(this, arguments); if (this === localStorage && String(key) === 'access_token') { if (valid(String(value))) save(String(value)); else clear(); } return result; };\n        proto.removeItem = function(key) { const result = remove.apply(this, arguments); if (this === localStorage && String(key) === 'access_token' && !blocked) clear(); return result; };\n        proto.clear = function() { const result = empty.apply(this, arguments); if (this === localStorage && !blocked) clear(); return result; };\n    } catch {}\n    const poll = () => {\n        if (blocked || location.origin !== config.origin) return;\n        const l = local(), c = cookie();\n        if ((lastLocal && !l) || (lastCookie && !c)) { clear(); return; }\n        const next = l && l !== lastLocal ? l : c && c !== lastCookie ? c : l || c;\n        lastLocal = l; lastCookie = c;\n        if (next && next !== last) save(next);\n    };\n    const endpoint = value => { try { const url = new URL(typeof value === 'string' ? value : value?.url || '', location.href); return url.origin === config.origin ? url.pathname : ''; } catch { return ''; } };\n    const logout = value => /\\/(?:logout|log-out|signout|sign-out)(?:\\/|$)/i.test(value);\n    const login = value => /\\/(?:login|log-in|signin|sign-in)(?:\\/|$)/i.test(value);\n    const receive = (path, data, started) => { if (revision === started && (!blocked || login(path))) save(data?.access_token); };\n    if (typeof window.fetch === 'function') {\n        const original = window.fetch;\n        window.fetch = function(input) {\n            const path = endpoint(input); if (logout(path)) clear(false); const started = revision;\n            return original.apply(this, arguments).then(response => {\n                if (logout(path)) clear();\n                else if (path && response.ok && response.clone && (!response.url || endpoint(response.url))) response.clone().json().then(data => receive(path, data, started)).catch(() => {});\n                return response;\n            }, error => { if (logout(path)) clear(); throw error; });\n        };\n    }\n    if (window.XMLHttpRequest?.prototype) {\n        const proto = window.XMLHttpRequest.prototype, open = proto.open, send = proto.send, paths = new WeakMap();\n        proto.open = function(method, url) { paths.set(this, endpoint(url)); return open.apply(this, arguments); };\n        proto.send = function() {\n            const path = paths.get(this) || ''; if (logout(path)) clear(false); const started = revision;\n            if (logout(path)) this.addEventListener('loadend', () => clear(), { once: true });\n            else if (path) this.addEventListener('load', () => { if (this.status >= 200 && this.status < 300 && (!this.responseURL || endpoint(this.responseURL))) { try { receive(path, this.responseType === 'json' ? this.response : JSON.parse(this.responseText), started); } catch {} } }, { once: true });\n            return send.apply(this, arguments);\n        };\n    }\n    window.addEventListener('storage', event => { if (event.storageArea === localStorage && (event.key === null || event.key === 'access_token')) { if (!valid(event.newValue)) clear(); else save(event.newValue); } });\n    document.addEventListener('click', event => { const link = event.target?.closest?.('a[href]'); if (link && logout(endpoint(link.href))) clear(false); }, true);\n    document.addEventListener('submit', event => { if (logout(endpoint(event.target?.action))) clear(false); }, true);\n    const start = () => { if (!timer) timer = setInterval(poll, 1000); };\n    window.addEventListener('pagehide', () => { poll(); clearInterval(timer); timer = undefined; });\n    window.addEventListener('pageshow', start); start(); return true;\n}" + ')(' + JSON.stringify({ origin: pageHost(), token: cleanToken(token) }) + ');true;';
    }
    function pageScript(token) {
      const saved = JSON.stringify(cleanToken(token) || "");
      return `${sessionScript(token)}(() => { try { var saved = ${saved}; var apply = function () { var meta = document.querySelector('meta[name="viewport"]'); if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); } meta.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'; var style = document.getElementById('mime-nighty-mobile-fit'); if (!style) { style = document.createElement('style'); style.id = 'mime-nighty-mobile-fit'; style.textContent = 'html,body,#root,#app{width:100%!important;max-width:100vw!important;margin-left:0!important;margin-right:0!important;overflow-x:hidden!important}*,*:before,*:after{box-sizing:border-box}'; document.head.appendChild(style); } document.documentElement.style.touchAction = 'pan-y'; if (document.body) { document.body.style.touchAction = 'pan-y'; document.body.style.marginBottom = '0'; } }; var restore = function () { if (!saved) return; var key = 'mime-nighty-restored'; var login = document.querySelector('input[type="password"]'); try { if (!login) { if (document.readyState !== 'loading') sessionStorage.removeItem(key); return; } var marker = saved.slice(-24); if (sessionStorage.getItem(key) === marker) return; sessionStorage.setItem(key, marker); location.reload(); } catch (e) {} }; apply(); restore(); document.addEventListener('DOMContentLoaded', function () { apply(); restore(); }, { once: true }); } catch (e) {} return true; })();`;
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
        const mod = r.find("initialWindowMetrics") || r.find("useSafeAreaInsets") || {};
        const insets = mod.initialWindowMetrics?.insets || mod.insets;
        const value = insets?.[edge];
        if (typeof value === "number" && value > 0 && value < 80) return Math.round(value);
      } catch {
      }
      return 0;
    }
    function NightyPage() {
      r.useRefresh();
      const src = pageUrl(store.url);
      const WebView = r.find("WebView")?.WebView || r.byName("WebView");
      const webViewRef = React.useRef(null);
      const savedSession = sessionToken();
      const [error, setError] = React.useState("");
      const frame = { flex: 1, width: "100%", backgroundColor: "#080D1B", overflow: "hidden" };
      const allow = (req) => {
        const url = req?.url || "";
        return !url || url === "about:blank" || url === src || !!pageUrl(url);
      };
      return h(
        RN.View,
        { style: frame },
        !src ? h(Text, null, "Set a valid HTTP or HTTPS URL in Nighty Tab settings.") : !WebView ? h(Text, null, "WebView is unavailable in this Snow build.") : h(WebView, {
          key: `${src}:${savedSession ? "signed-in" : "signed-out"}`,
          ref: webViewRef,
          source: { uri: src, ...savedSession ? { headers: {} } : {} },
          style: { flex: 1, width: "100%", backgroundColor: "#080D1B" },
          containerStyle: { flex: 1, backgroundColor: "#080D1B" },
          originWhitelist: ["http://*", "https://*"],
          javaScriptEnabled: true,
          domStorageEnabled: true,
          cacheEnabled: true,
          sharedCookiesEnabled: true,
          thirdPartyCookiesEnabled: true,
          incognito: false,
          startInLoadingState: true,
          injectedJavaScriptBeforeContentLoaded: pageScript(savedSession),
          injectedJavaScript: pageScript(savedSession),
          pullToRefreshEnabled: true,
          bounces: true,
          directionalLockEnabled: true,
          showsHorizontalScrollIndicator: false,
          showsVerticalScrollIndicator: false,
          setBuiltInZoomControls: false,
          displayZoomControls: false,
          scalesPageToFit: false,
          allowsBackForwardNavigationGestures: false,
          automaticallyAdjustContentInsets: false,
          contentInsetAdjustmentBehavior: "never",
          contentInset: { top: 0, right: 0, bottom: 0, left: 0 },
          overScrollMode: "never",
          onMessage: onSessionMessage,
          onShouldStartLoadWithRequest: allow,
          onError: (event) => setError(event.nativeEvent?.description || "Could not load Nighty."),
          onHttpError: (event) => setError(`Nighty returned HTTP ${event.nativeEvent?.statusCode}.`),
          onLoad: () => setError(""),
          onLoadEnd: () => webViewRef.current?.injectJavaScript?.(pageScript(sessionToken()))
        }),
        error ? h(Text, null, error) : null
      );
    }
    function Settings({ close }) {
      r.useRefresh();
      const selectedLogo = store.iconType === "grayscale" ? "white" : store.iconType;
      const sectionLabel = (label) => h(RN.Text, { style: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "600", marginLeft: 4, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 } }, label);
      const card = (...children) => h(RN.View, { style: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" } }, ...children);
      const divider = () => h(RN.View, { style: { height: 1, backgroundColor: colors.border, marginLeft: 16 } });
      const field = ({ value, onChange, placeholder, maxLength, keyboardType }) => h(RN.TextInput, {
        value,
        onChangeText: onChange,
        placeholder,
        placeholderTextColor: "#6D6F78",
        autoCapitalize: "none",
        autoCorrect: false,
        maxLength,
        keyboardType,
        selectionColor: colors.accent,
        style: { minHeight: 50, color: colors.text, fontSize: 16, lineHeight: 21, backgroundColor: "#151619", borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 }
      });
      const switchRow = (setting, title, description) => h(RN.View, { style: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 } },
        h(RN.View, { style: { flex: 1 } },
          h(RN.Text, { style: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: "600", marginBottom: 3 } }, title),
          h(RN.Text, { style: { color: colors.muted, fontSize: 14, lineHeight: 19 } }, description)
        ),
        h(RN.Switch, { value: !!store[setting], onValueChange: (value) => r.set(setting, value), trackColor: { false: "#3F4147", true: colors.accent }, thumbColor: "#FFFFFF", ios_backgroundColor: "#3F4147" })
      );
      const logoChoice = (value, label, detail) => {
        const selected = selectedLogo === value;
        const uri = value === "custom" ? pageUrl(store.customIconUrl) : nightyBlueAsset;
        return h(RN.Pressable || RN.TouchableOpacity, {
          key: value,
          accessibilityRole: "radio",
          accessibilityState: { selected },
          onPress: () => r.set("iconType", value),
          style: ({ pressed } = {}) => ({ minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12, backgroundColor: pressed ? colors.surfacePressed : colors.surface })
        },
        h(RN.View, { style: { width: 42, height: 34, borderRadius: 10, backgroundColor: "#151619", alignItems: "center", justifyContent: "center" } }, uri ? h(RN.Image, { source: { uri }, resizeMode: "contain", style: { width: 30, height: 30, transform: [{ scale: 1.35 }], ...value === "white" ? { tintColor: colors.text } : {} } }) : h(RN.Text, { style: { color: colors.muted, fontSize: 17 } }, "+")),
        h(RN.View, { style: { flex: 1 } }, h(RN.Text, { style: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: "600" } }, label), h(RN.Text, { style: { color: colors.muted, fontSize: 13, lineHeight: 17, marginTop: 2 } }, detail)),
        h(RN.View, { style: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.accent : "#5B5D66", alignItems: "center", justifyContent: "center" } }, selected ? h(RN.View, { style: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent } }) : null)
        );
      };
      return h(
        RN.ScrollView,
        { style: { flex: 1, backgroundColor: colors.background }, contentContainerStyle: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 36 }, keyboardShouldPersistTaps: "handled", showsVerticalScrollIndicator: false },
        sectionLabel("Nighty website"),
        card(h(RN.View, { style: { padding: 14 } },
          field({ value: store.url, placeholder: "https://nighty.example", onChange: (value) => r.set("url", value), keyboardType: "url" }),
          store.url && !pageUrl(store.url) ? h(RN.Text, { style: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: 8 } }, "Use an HTTP or HTTPS address without a username or password.") : null,
          h(RN.Pressable || RN.TouchableOpacity, { accessibilityRole: "button", onPress: () => { if (!openNighty()) openSheet(); }, style: ({ pressed } = {}) => ({ height: 48, borderRadius: 12, backgroundColor: pressed ? "#4752C4" : colors.accent, alignItems: "center", justifyContent: "center", marginTop: 12 }) }, h(RN.Text, { style: { color: "#FFFFFF", fontSize: 16, lineHeight: 20, fontWeight: "700" } }, "Open Nighty")),
          h(RN.Text, { style: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 } }, sessionToken() ? "Login saved for this address." : "Sign in once to save your login.")
        )),
        h(RN.View, { style: { height: 22 } }),
        sectionLabel("Behavior"),
        card(switchRow("showNightyButton", "Profile shortcut", "Add Nighty beside Settings on your profile."), divider(), switchRow("scriptUtils", "Script utilities", "Add Download Script to attachment menus.")),
        h(RN.View, { style: { height: 22 } }),
        sectionLabel("Command prefix"),
        card(h(RN.View, { style: { padding: 14 } }, field({ value: store.nightyPrefix, placeholder: ".", maxLength: 1, onChange: (value) => r.set("nightyPrefix", value) }), h(RN.Text, { style: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 8 } }, "Nighty reads this character before script commands."))),
        h(RN.View, { style: { height: 22 } }),
        sectionLabel("Logo"),
        card(logoChoice("white", "White", "Matches Discord's profile icons."), divider(), logoChoice("blue", "Nighty blue", "Shows Nighty's blue logo."), divider(), logoChoice("custom", "Custom image", "Uses an icon from an HTTPS address.")),
        selectedLogo === "custom" ? h(RN.View, { style: { marginTop: 10 } }, field({ value: store.customIconUrl, placeholder: "https://example.com/icon.png", onChange: (value) => r.set("customIconUrl", value), keyboardType: "url" })) : null,
        close ? h(RN.Pressable || RN.TouchableOpacity, { onPress: close, style: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 18 } }, h(RN.Text, { style: { color: colors.muted, fontSize: 15, fontWeight: "600" } }, "Close")) : null
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
        style: { width: selectedIconSize, height: selectedIconSize, ...iconTint() ? { tintColor: iconTint() } : {} }
      });
    }
    function profileImage() {
      const uri = iconUrl();
      if (!uri) return null;
      return h(
        RN.View,
        { style: { width: selectedIconSize, height: selectedIconSize, alignItems: "center", justifyContent: "center" } },
        h(RN.Image, {
          source: { uri },
          resizeMode: "contain",
          fadeDuration: 0,
          accessibilityIgnoresInvertColors: true,
          style: { width: selectedIconSize, height: selectedIconSize, ...iconTint() ? { tintColor: iconTint() } : {} }
        })
      );
    }
    function ProfileBarIcon() {
      return profileImage();
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
    function treeContainsSettingsLabel(node) {
      if (Array.isArray(node)) return node.some(treeContainsSettingsLabel);
      if (typeof node === "string") return isSettingsText(node);
      if (!React.isValidElement(node)) return false;
      return treeContainsSettingsLabel(node.props?.children);
    }
    function treeContainsNightyLabel(node) {
      if (Array.isArray(node)) return node.some(treeContainsNightyLabel);
      if (typeof node === "string") return /^Nighty$/i.test(node.trim());
      if (!React.isValidElement(node)) return false;
      return treeContainsNightyLabel(node.props?.children);
    }
    function repairNightyChildren(node, state) {
      if (Array.isArray(node)) {
        const labelIndex = node.findIndex(treeContainsNightyLabel);
        return node.map((child, index) => {
          if (!state.icon && labelIndex >= 0 && index !== labelIndex && React.isValidElement(child)) {
            state.icon = true;
            state.changed = true;
            return profileImage();
          }
          return repairNightyChildren(child, state);
        });
      }
      if (!React.isValidElement(node)) return node;
      const props = {};
      for (const key of ["icon", "Icon", "IconComponent", "renderIcon", "leading", "leadingIcon", "iconSource", "iconName", "glyph", "image"]) {
        if (node.props?.[key] != null) {
          props[key] = typeof node.props[key] === "function" ? ProfileBarIcon : profileImage();
          state.changed = true;
        }
      }
      if (node.props?.children != null) props.children = repairNightyChildren(node.props.children, state);
      return Object.keys(props).length ? React.cloneElement(node, props) : node;
    }
    function repairNightyControl(element) {
      if (!isIconControl(element)) return element;
      const marker = [element.props?.testID, element.props?.nativeID, element.props?.id, element.props?.accessibilityHint].filter(Boolean).join(" ");
      const isNighty = /mime-nighty-profile-button|Open Nighty/i.test(marker);
      if (!isNighty) return element;
      const state = { icon: false, changed: false };
      const props = {};
      for (const key of ["icon", "Icon", "IconComponent", "renderIcon", "leading", "leadingIcon", "iconSource", "iconName", "glyph", "image"]) {
        if (element.props?.[key] != null) {
          props[key] = typeof element.props[key] === "function" ? ProfileBarIcon : profileImage();
          state.changed = true;
        }
      }
      if (element.props?.children != null) props.children = repairNightyChildren(element.props.children, state);
      return state.changed ? React.cloneElement(element, props) : element;
    }
    function nativeControlTree(node, depth = 0, state = { icon: false }) {
      if (Array.isArray(node)) {
        const labelIndex = node.findIndex(treeContainsSettingsLabel);
        return node.map((child, index) => {
          if (!state.icon && labelIndex >= 0 && index !== labelIndex && React.isValidElement(child)) {
            state.icon = true;
            return profileImage();
          }
          return nativeControlTree(child, depth, state);
        });
      }
      if (typeof node === "string") return isSettingsText(node) ? "Nighty" : node;
      if (!React.isValidElement(node)) return node;
      const hint = `${iconHint(node)} ${nodeText(node)}`;
      if (!state.icon && depth > 0 && /SettingsIcon|GearIcon|CogIcon|\b(?:gear|cog)\b/i.test(hint) && !pressProps(node.props)) {
        state.icon = true;
        return profileImage();
      }
      const props = {};
      for (const key of ["icon", "Icon", "IconComponent", "renderIcon", "leading", "leadingIcon"]) {
        if (node.props?.[key] != null) {
          props[key] = typeof node.props[key] === "function" ? ProfileBarIcon : profileImage();
        }
      }
      for (const key of ["accessibilityLabel", "accessibilityHint", "aria-label", "testID", "nativeID", "label", "name", "id"]) {
        if (typeof node.props?.[key] === "string" && isSettingsText(node.props[key])) props[key] = "Nighty";
      }
      if (node.props?.children != null) props.children = nativeControlTree(node.props.children, depth + 1, state);
      return React.cloneElement(node, props);
    }
    function NightyProfileButton({ sample }) {
      r.useRefresh();
      const onPress = press();
      if (React.isValidElement(sample)) {
        const native = nativeControlTree(sample);
        return React.cloneElement(native, {
          key: "mime-nighty-profile-button",
          accessibilityLabel: "Nighty",
          accessibilityHint: "Open Nighty",
          testID: "mime-nighty-profile-button",
          onPress,
          onPressOut: void 0
        });
      }
      return h(
        RN.Pressable || RN.TouchableOpacity,
        {
          accessibilityLabel: "Nighty",
          accessibilityHint: "Open Nighty",
          accessibilityRole: "button",
          testID: "mime-nighty-profile-button",
          onPress,
          style: { flex: 1, alignItems: "center", justifyContent: "center" }
        },
        profileImage(),
        h(RN.Text, { style: { color: "#F2F3F5", fontSize: 14, lineHeight: 18, fontWeight: "500", marginTop: 2 } }, "Nighty")
      );
    }
    function nightyControl(sample) {
      return h(NightyProfileButton, { key: "mime-nighty-profile-button", sample });
    }
    function nightyRecord(sample) {
      const image = toolbarIcon();
      const record = {};
      if (sample && typeof sample === "object") for (const [key, value] of Object.entries(sample)) {
        if (!/(?:icon|image|glyph|leading)/i.test(key)) record[key] = value;
      }
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
      const repaired = repairNightyControl(element);
      if (repaired !== element) return repaired;
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
      r.status.settingsEntry = registerSection(r, { name: "Nighty", items: [{
        key: "MIME_NIGHTY",
        title: () => "Nighty",
        headerShown: false,
        IconComponent: Icon,
        onPress: () => { if (!openNighty()) openSheet(); },
        render: async () => ({ default: NightyPage })
      }] });
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
  NightyTab.defaults = { url: "", scriptUtils: false, nightyPrefix: ".", iconType: "white", customIconUrl: "", showNightyButton: true, sessionHost: "", sessionToken: "", sessions: {} };

  // NightyTab.entry.js
  var NightyTab_entry_default = register({ "id": "mime.nightytab", "name": "Nighty Tab", "description": "Open Nighty from Discord mobile settings or the profile action bar.", "version": "1.14.1", "authors": [{ "name": "Mime | N0_.q3", "id": "957164619061932045" }, { "name": "rico | wkcp", "id": "1361736124858630274" }], "license": "GPL-3.0-or-later", "source": "https://github.com/xMimiez/Snow-Plugins/tree/main/NightyTab" }, NightyTab);
  return __toCommonJS(NightyTab_entry_exports);
})();
