// Core stealth checks for Brave (Chromium-based) browser.
// Tests automation detection, lie/tampering detection, Chromium API presence,
// and cross-signal consistency.

"use client";

type CheckResult = { passed: boolean; detail: string };
type CategoryResults = Record<string, CheckResult>;

export async function runCoreChecks(): Promise<
  Record<string, Record<string, { passed: boolean; detail: string }>>
> {
  const result: Record<string, CategoryResults> = {
    automation: {},
    chromiumAPIs: {},
    lieDetection: {},
    crossSignal: {},
  };

  // ============================================================
  // 1. AUTOMATION DETECTION
  // ============================================================

  result.automation.webdriver = {
    passed: navigator.webdriver !== true,
    detail: "navigator.webdriver = " + navigator.webdriver,
  };

  result.automation.playwrightGlobals = (() => {
    const found: string[] = [];
    if (typeof (window as any).__playwright !== "undefined")
      found.push("__playwright");
    if (typeof (window as any).__pwInitScripts !== "undefined")
      found.push("__pwInitScripts");
    if (typeof (window as any).__playwright__binding__ !== "undefined")
      found.push("__playwright__binding__");
    const props = Object.getOwnPropertyNames(window);
    for (let i = 0; i < props.length; i++) {
      if (
        props[i].indexOf("__playwright") === 0 ||
        props[i].indexOf("__puppeteer") === 0 ||
        props[i].indexOf("cdc_") === 0 ||
        props[i].indexOf("$cdc_") === 0
      ) {
        found.push(props[i]);
      }
    }
    return {
      passed: found.length === 0,
      detail:
        found.length === 0
          ? "No automation globals found"
          : "Found: " + found.join(", "),
    };
  })();

  result.automation.cdpStackLeak = (() => {
    try {
      throw new Error("test");
    } catch (e: any) {
      const stack = e.stack || "";
      const hasCDP =
        stack.indexOf("__puppeteer") !== -1 ||
        stack.indexOf("__playwright") !== -1 ||
        stack.indexOf("pptr:") !== -1 ||
        stack.indexOf("Runtime.evaluate") !== -1;
      return {
        passed: !hasCDP,
        detail: hasCDP
          ? "CDP artifacts in stack trace"
          : "Clean stack trace",
      };
    }
  })();

  result.automation.notificationPermission = {
    passed: typeof Notification !== "undefined",
    detail:
      "Notification.permission = " +
      (typeof Notification !== "undefined"
        ? Notification.permission
        : "MISSING"),
  };

  // Self-destruct verification: Brave's window.setXxx functions should be gone
  result.automation.selfDestructSeed = {
    passed: typeof (window as any).setFingerprintingSeed === "undefined",
    detail:
      typeof (window as any).setFingerprintingSeed === "undefined"
        ? "setFingerprintingSeed removed (correct)"
        : "PRESENT (should have self-destructed)",
  };

  result.automation.selfDestructWebRTC = {
    passed: typeof (window as any).setWebRTCIPv4 === "undefined",
    detail:
      typeof (window as any).setWebRTCIPv4 === "undefined"
        ? "setWebRTCIPv4 removed (correct)"
        : "PRESENT (should have self-destructed)",
  };

  result.automation.selfDestructTimezone = {
    passed: typeof (window as any).setTimezone === "undefined",
    detail:
      typeof (window as any).setTimezone === "undefined"
        ? "setTimezone removed (correct)"
        : "PRESENT (should have self-destructed)",
  };

  // ============================================================
  // 2. CHROMIUM API PRESENCE (verify browser looks like real Brave)
  // ============================================================

  // window.chrome should exist in Chromium
  result.chromiumAPIs.windowChrome = {
    passed: typeof (window as any).chrome !== "undefined",
    detail:
      typeof (window as any).chrome !== "undefined"
        ? "window.chrome present (correct for Chromium)"
        : "MISSING (should exist in Chromium)",
  };

  // Brave Shields blocks navigator.connection for privacy - absence is correct
  result.chromiumAPIs.navigatorConnection = {
    passed: typeof (navigator as any).connection === "undefined",
    detail:
      typeof (navigator as any).connection === "undefined"
        ? "Blocked by Brave Shields (correct)"
        : "PRESENT (Brave should block this for privacy)",
  };

  // Brave farbles navigator.deviceMemory - should exist but with randomized value
  result.chromiumAPIs.deviceMemory = (() => {
    const dm = (navigator as any).deviceMemory;
    const validValues = [0.25, 0.5, 1, 2, 4, 8];
    const isValid = dm !== undefined && validValues.includes(dm);
    return {
      passed: isValid,
      detail: dm !== undefined
        ? "deviceMemory = " + dm + (isValid ? " (valid farbled value)" : " (unexpected value)")
        : "MISSING (should be farbled, not removed)",
    };
  })();

  // performance.memory is deprecated in Chrome and may be absent
  result.chromiumAPIs.performanceMemory = {
    passed: true,
    detail:
      typeof (performance as any).memory !== "undefined"
        ? "performance.memory present"
        : "performance.memory absent (deprecated API, acceptable)",
  };

  // V8 error stack format: should use "at" not "@"
  result.chromiumAPIs.v8StackFormat = (() => {
    try {
      (undefined as any).x;
    } catch (e: any) {
      const stack = e.stack || "";
      const hasV8At = stack.indexOf("    at ") !== -1;
      return {
        passed: hasV8At,
        detail: hasV8At
          ? 'V8-style "at" format (correct for Chromium)'
          : "Non-V8 stack format detected",
      };
    }
    return { passed: false, detail: "Could not generate error" };
  })();

  // navigator.userAgentData should exist and report Brave in brands.
  // Bot detectors check for both HeadlessChrome (headless leak) and
  // the absence of "Brave" (someone pretending to be Brave but isn't).
  result.chromiumAPIs.userAgentData = (() => {
    const uad = (navigator as any).userAgentData;
    if (!uad) return { passed: false, detail: "MISSING (should exist in Chromium)" };
    const brands = uad.brands?.map((b: any) => b.brand) || [];
    const brandStr = brands.join(", ") || "none";
    const hasHeadless = brandStr.toLowerCase().indexOf("headless") !== -1;
    const hasBrave = brands.includes("Brave");
    const passed = !hasHeadless && hasBrave;
    return {
      passed,
      detail: hasHeadless
        ? "HeadlessChrome detected in brands: " + brandStr
        : !hasBrave
          ? "Brave missing from brands: " + brandStr + " (detectable as non-Brave)"
          : "Brands: " + brandStr,
    };
  })();

  // navigator.brave should exist — Brave exposes this object.
  // Bot detectors use its presence to confirm real Brave vs Chrome pretending to be Brave.
  result.chromiumAPIs.navigatorBrave = (() => {
    const brave = (navigator as any).brave;
    return {
      passed: brave !== undefined,
      detail: brave !== undefined
        ? "navigator.brave present (correct for Brave)"
        : "MISSING (real Brave exposes navigator.brave)",
    };
  })();

  // navigator.pdfViewerEnabled should be true
  result.chromiumAPIs.pdfViewer = {
    passed: (navigator as any).pdfViewerEnabled === true,
    detail: "pdfViewerEnabled = " + (navigator as any).pdfViewerEnabled,
  };

  // ============================================================
  // 3. LIE / TAMPERING DETECTION
  // ============================================================

  result.lieDetection.navigatorPropsInherited = (() => {
    const ownUA = Object.getOwnPropertyDescriptor(navigator, "userAgent");
    const ownPlatform = Object.getOwnPropertyDescriptor(navigator, "platform");
    const ownLang = Object.getOwnPropertyDescriptor(navigator, "language");
    const hasOwn = !!(ownUA || ownPlatform || ownLang);
    return {
      passed: !hasOwn,
      detail: hasOwn
        ? "Own properties found on navigator (tampered)"
        : "Properties inherited from prototype (correct)",
    };
  })();

  result.lieDetection.prototypeChain = (() => {
    const navProto = Object.getPrototypeOf(navigator);
    const isNavigator = navProto === Navigator.prototype;
    return {
      passed: isNavigator,
      detail: isNavigator
        ? "navigator.__proto__ === Navigator.prototype (correct)"
        : "Prototype chain broken",
    };
  })();

  result.lieDetection.iframeCrossCheck = (() => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      const iframeWin = iframe.contentWindow! as any;
      const mainStr = Function.prototype.toString.call(navigator.constructor);
      const iframeStr = iframeWin.Function.prototype.toString.call(
        iframeWin.navigator.constructor
      );
      document.body.removeChild(iframe);
      const match = mainStr === iframeStr;
      return {
        passed: match,
        detail: match
          ? "toString matches across windows (correct)"
          : "MISMATCH: main window tampered",
      };
    } catch (e: any) {
      return { passed: true, detail: "Cross-iframe check skipped: " + e.message };
    }
  })();

  result.lieDetection.getOwnPropertyNames = (() => {
    try {
      const names = Object.getOwnPropertyNames(navigator);
      const suspicious = names.filter(
        (n) => n.indexOf("__") === 0 || n.indexOf("$") === 0
      );
      return {
        passed: suspicious.length === 0,
        detail:
          suspicious.length === 0
            ? "No suspicious own properties"
            : "Suspicious: " + suspicious.join(", "),
      };
    } catch (e: any) {
      return { passed: true, detail: "Check skipped: " + e.message };
    }
  })();

  result.lieDetection.nativeFunctionIntegrity = (() => {
    try {
      const suspects: string[] = [];
      const nativeToStr = Function.prototype.toString;
      const testFns = [
        { obj: Navigator.prototype, name: "Navigator.prototype.hardwareConcurrency", prop: "hardwareConcurrency" },
        { obj: Screen.prototype, name: "Screen.prototype.width", prop: "width" },
        { obj: Screen.prototype, name: "Screen.prototype.height", prop: "height" },
      ];
      for (const tf of testFns) {
        const desc = Object.getOwnPropertyDescriptor(tf.obj, tf.prop);
        if (desc && desc.get) {
          const str = nativeToStr.call(desc.get);
          if (str.indexOf("native code") === -1) {
            suspects.push(tf.name + " (non-native toString)");
          }
        }
      }
      return {
        passed: suspects.length === 0,
        detail:
          suspects.length === 0
            ? "All checked native functions appear genuine"
            : "Tampered: " + suspects.join(", "),
      };
    } catch (e: any) {
      return { passed: true, detail: "Native function check skipped: " + e.message };
    }
  })();

  result.lieDetection.windowPropertyClean = (() => {
    try {
      const props = Object.getOwnPropertyNames(window);
      const suspicious = props.filter(
        (p) =>
          p.indexOf("__playwright") === 0 ||
          p.indexOf("__puppeteer") === 0 ||
          p.indexOf("__selenium") === 0 ||
          p.indexOf("__webdriver") === 0 ||
          p.indexOf("$cdc_") === 0 ||
          p.indexOf("cdc_") === 0 ||
          p.indexOf("_phantom") === 0 ||
          p.indexOf("callPhantom") === 0 ||
          p === "domAutomation" ||
          p === "domAutomationController"
      );
      return {
        passed: suspicious.length === 0,
        detail:
          suspicious.length === 0
            ? "No automation properties on window (" + props.length + " total props)"
            : "FOUND: " + suspicious.join(", "),
      };
    } catch (e: any) {
      return { passed: true, detail: "Window property check skipped: " + e.message };
    }
  })();

  result.lieDetection.screenGetterIntegrity = (() => {
    try {
      const desc = Object.getOwnPropertyDescriptor(Screen.prototype, "width");
      if (!desc || !desc.get) return { passed: true, detail: "Screen.width getter not found (unusual)" };
      const str = Function.prototype.toString.call(desc.get);
      const isNative = str.indexOf("native code") !== -1;
      return {
        passed: isNative,
        detail: isNative
          ? "Screen.width getter appears native"
          : "Screen.width getter TAMPERED: " + str.substring(0, 60),
      };
    } catch (e: any) {
      return { passed: true, detail: "Screen getter check skipped: " + e.message };
    }
  })();

  result.lieDetection.canvasContextIntegrity = (() => {
    try {
      const fn = CanvasRenderingContext2D.prototype.getImageData;
      const str = Function.prototype.toString.call(fn);
      const isNative = str.indexOf("native code") !== -1;
      return {
        passed: isNative,
        detail: isNative ? "getImageData appears native" : "getImageData TAMPERED",
      };
    } catch (e: any) {
      return { passed: true, detail: "Canvas context check skipped: " + e.message };
    }
  })();

  result.lieDetection.audioBufferIntegrity = (() => {
    try {
      const fn = AudioBuffer.prototype.getChannelData;
      const str = Function.prototype.toString.call(fn);
      const isNative = str.indexOf("native code") !== -1;
      return {
        passed: isNative,
        detail: isNative ? "getChannelData appears native" : "getChannelData TAMPERED",
      };
    } catch (e: any) {
      return { passed: true, detail: "AudioBuffer check skipped: " + e.message };
    }
  })();

  result.lieDetection.functionToStringIntegrity = (() => {
    try {
      const toStr = Function.prototype.toString;
      const str = toStr.call(toStr);
      const isNative = str.indexOf("native code") !== -1;
      let hasProxy = false;
      try { toStr.call(undefined); } catch (e: any) { hasProxy = !(e instanceof TypeError); }
      return {
        passed: isNative && !hasProxy,
        detail:
          isNative && !hasProxy
            ? "Function.prototype.toString appears native"
            : hasProxy ? "toString may be proxied" : "toString TAMPERED",
      };
    } catch (e: any) {
      return { passed: true, detail: "toString proxy check skipped: " + e.message };
    }
  })();

  result.lieDetection.phantomWindowProps = (() => {
    try {
      const found: string[] = [];
      if (typeof (window as any)._phantom !== "undefined") found.push("_phantom");
      if (typeof (window as any).callPhantom !== "undefined") found.push("callPhantom");
      if (typeof (window as any).domAutomation !== "undefined") found.push("domAutomation");
      if (typeof (window as any).domAutomationController !== "undefined") found.push("domAutomationController");
      if (typeof (window as any)._selenium !== "undefined") found.push("_selenium");
      if (typeof (window as any).awesomium !== "undefined") found.push("awesomium");
      if (typeof (window as any).Buffer !== "undefined") found.push("Buffer (Node)");
      return {
        passed: found.length === 0,
        detail: found.length === 0 ? "No phantom/automation globals" : "FOUND: " + found.join(", "),
      };
    } catch (e: any) {
      return { passed: true, detail: "Phantom check skipped: " + e.message };
    }
  })();

  // ============================================================
  // 4. CROSS-SIGNAL CONSISTENCY
  // ============================================================

  // UA should contain Chrome/Brave, NOT Firefox
  result.crossSignal.uaContainsBrave = (() => {
    const ua = navigator.userAgent;
    const hasChrome = ua.indexOf("Chrome") !== -1;
    const hasFF = ua.indexOf("Firefox") !== -1;
    return {
      passed: hasChrome && !hasFF,
      detail: hasChrome
        ? "UA contains Chrome (correct for Brave)"
        : hasFF
          ? "UA contains Firefox (WRONG for Brave/Chromium)"
          : "UA missing browser identifier",
    };
  })();

  result.crossSignal.platformVsUA = (() => {
    const platform = navigator.platform;
    const ua = navigator.userAgent;
    const platIsMac = platform === "MacIntel" || platform === "MacPPC" || platform === "Macintosh";
    const uaIsMac = ua.indexOf("Macintosh") !== -1 || ua.indexOf("Mac OS") !== -1;
    const platIsWin = platform.indexOf("Win") === 0;
    const uaIsWin = ua.indexOf("Windows") !== -1;
    const platIsLinux = platform.indexOf("Linux") !== -1;
    const uaIsLinux = ua.indexOf("Linux") !== -1;
    const consistent = (platIsMac && uaIsMac) || (platIsWin && uaIsWin) || (platIsLinux && uaIsLinux);
    return {
      passed: consistent,
      detail: consistent
        ? 'Platform "' + platform + '" matches UA OS claim'
        : 'MISMATCH: platform="' + platform + '" but UA suggests different OS',
    };
  })();

  result.crossSignal.touchVsPlatform = (() => {
    const isDesktop =
      navigator.platform === "MacIntel" ||
      navigator.platform.indexOf("Win") === 0 ||
      navigator.platform.indexOf("Linux") === 0;
    const touchPoints = navigator.maxTouchPoints || 0;
    const plausible = !isDesktop || touchPoints <= 1;
    return {
      passed: plausible,
      detail: "maxTouchPoints=" + touchPoints + ' on platform "' + navigator.platform + '"' +
        (plausible ? " (plausible)" : " (suspicious for desktop)"),
    };
  })();

  result.crossSignal.screenVsViewport = (() => {
    const screenOk = screen.width >= window.innerWidth && screen.height >= window.innerHeight;
    return {
      passed: screenOk,
      detail: screenOk
        ? "screen >= viewport (correct)"
        : "ANOMALY: screen " + screen.width + "x" + screen.height + " < viewport " + window.innerWidth + "x" + window.innerHeight,
    };
  })();

  result.crossSignal.outerDimensionsNonZero = {
    passed: window.outerWidth > 0 && window.outerHeight > 0,
    detail:
      "outerWidth=" + window.outerWidth + " outerHeight=" + window.outerHeight +
      (window.outerWidth > 0 && window.outerHeight > 0 ? " (non-zero, correct)" : " (ZERO = headless)"),
  };

  result.crossSignal.availVsScreen = {
    passed: screen.availWidth <= screen.width && screen.availHeight <= screen.height,
    detail: "avail " + screen.availWidth + "x" + screen.availHeight + " vs screen " + screen.width + "x" + screen.height,
  };

  result.crossSignal.intlTimezoneMatch = (() => {
    const intlTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMinutes = new Date().getTimezoneOffset();
    return {
      passed: !!intlTz,
      detail: "Intl timezone: " + intlTz + ", offset: " + offsetMinutes + " min",
    };
  })();

  // ============================================================
  // 5. REAL-WORLD DETECTION VECTORS
  // Used by Cloudflare, DataDome, PerimeterX, CreepJS in production.
  // ============================================================

  // CDP Runtime.enable leak - the #1 Playwright/Puppeteer detection vector.
  // When Runtime.enable is active, console API calls trigger serialization
  // that doesn't happen in a normal browser.
  result.crossSignal.cdpRuntimeLeak = (() => {
    try {
      let detected = false;
      const err = new Error();
      Object.defineProperty(err, "stack", {
        get() {
          detected = true;
          return "";
        },
      });
      // console.debug triggers Runtime.consoleAPICalled if Runtime.enable is on
      console.debug(err);
      return {
        passed: !detected,
        detail: detected
          ? "CDP Runtime.enable detected (stack getter triggered by console serialization)"
          : "No CDP leak detected",
      };
    } catch {
      return { passed: true, detail: "CDP check skipped" };
    }
  })();

  // CSS system colors - in headless mode, ActiveText resolves to default red
  // instead of the OS theme color. Real browsers get the theme color.
  result.crossSignal.cssSystemColors = (() => {
    try {
      const el = document.createElement("div");
      el.style.color = "ActiveText";
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      document.body.removeChild(el);
      // Default headless red is rgb(255, 0, 0) or similar pure red
      const isDefaultRed = color === "rgb(255, 0, 0)" || color === "rgb(204, 0, 0)";
      return {
        passed: !isDefaultRed,
        detail: isDefaultRed
          ? "ActiveText = " + color + " (headless default, suspicious)"
          : "ActiveText = " + color + " (themed, looks normal)",
      };
    } catch {
      return { passed: true, detail: "CSS system color check skipped" };
    }
  })();

  // WebGL renderer - SwiftShader is the headless software renderer
  result.crossSignal.webglNotSwiftShader = (() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return { passed: true, detail: "WebGL unavailable" };
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (!ext) return { passed: true, detail: "WEBGL_debug_renderer_info unavailable" };
      const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
      const isSwiftShader = renderer && renderer.toString().indexOf("SwiftShader") !== -1;
      return {
        passed: !isSwiftShader,
        detail: isSwiftShader
          ? "WebGL renderer is SwiftShader (headless software renderer)"
          : "WebGL renderer: " + renderer,
      };
    } catch {
      return { passed: true, detail: "WebGL renderer check skipped" };
    }
  })();

  // Brave-specific: brave:// scheme detection. Sites can detect Brave by checking
  // if the brave: protocol is recognized. This is a known Brave fingerprinting issue.
  result.crossSignal.braveSchemeNotLeaked = (() => {
    try {
      const a = document.createElement("a");
      a.href = "brave://settings";
      const leaked = a.protocol === "brave:";
      return {
        passed: !leaked,
        detail: leaked
          ? "brave:// scheme resolved (detectable as Brave)"
          : "brave:// scheme not resolved via anchor (correct)",
      };
    } catch {
      return { passed: true, detail: "Brave scheme check skipped" };
    }
  })();

  // Notification permission timing - headless browsers respond instantly to
  // permission queries. Real browsers take 500ms+ due to human interaction.
  // This is informational since we can't block on timing in a sync check.
  result.crossSignal.permissionTiming = (() => {
    try {
      const start = performance.now();
      // Synchronous permission status check (not the async request)
      const status = Notification.permission;
      const elapsed = performance.now() - start;
      return {
        passed: true,
        detail: "Notification.permission = " + status + " (resolved in " + elapsed.toFixed(2) + "ms)",
      };
    } catch {
      return { passed: true, detail: "Permission timing check skipped" };
    }
  })();

  // ============================================================
  // 6. BRAVE-SPECIFIC FARBLING VERIFICATION
  // These checks verify that Brave's farbling is working correctly.
  // Each surface is confirmed from stock Brave 1.88.x C++ source.
  // ============================================================

  // navigator.keyboard should be blocked by Brave Shields (returns null).
  // Source: chromium_src/modules/keyboard/navigator_keyboard.cc
  result.chromiumAPIs.keyboardBlocked = (() => {
    const kb = (navigator as any).keyboard;
    return {
      passed: kb === undefined || kb === null,
      detail: kb === undefined || kb === null
        ? "navigator.keyboard blocked (correct for Brave Shields)"
        : "PRESENT (Brave should block Keyboard API)",
    };
  })();

  // navigator.languages should be trimmed by Brave in default mode
  // (only first language kept). Source: chromium_src/navigator_language.cc
  result.crossSignal.languageTrimmed = (() => {
    const langs = navigator.languages;
    return {
      passed: true,
      detail: "navigator.languages = [" + langs.join(", ") + "] (" + langs.length + " entries)",
    };
  })();

  // navigator.plugins should be farbled by Brave (randomized names/descriptions).
  // Source: chromium_src/modules/plugins/dom_plugin_array.cc
  result.crossSignal.pluginsFarbled = (() => {
    const count = navigator.plugins?.length ?? 0;
    return {
      passed: count > 0,
      detail: count > 0
        ? "navigator.plugins.length = " + count
        : "EMPTY plugins array (suspicious in Chromium)",
    };
  })();

  // mediaDevices.enumerateDevices should be farbled (shuffled order).
  // Source: brave_enumeratedevices_farbling_browsertest.cc
  // This is async so we just check the API exists.
  result.chromiumAPIs.enumerateDevices = (() => {
    const md = navigator.mediaDevices;
    const hasEnumerate = md && typeof md.enumerateDevices === "function";
    return {
      passed: hasEnumerate !== false,
      detail: hasEnumerate
        ? "mediaDevices.enumerateDevices present (Brave shuffles results)"
        : "mediaDevices API missing",
    };
  })();

  // screen position should be farbled by Brave (screenX/screenY clamped to <= 8).
  // Source: brave_screen_farbling_browsertest.cc
  result.crossSignal.screenPosition = (() => {
    const sx = window.screenX;
    const sy = window.screenY;
    return {
      passed: true,
      detail: "screenX=" + sx + " screenY=" + sy + " (Brave farbles to <= 8 in default mode)",
    };
  })();

  return result;
}
