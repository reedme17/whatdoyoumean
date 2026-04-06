import SwiftUI
import WebKit

/// Loads the onboarding SVG in a WKWebView so CSS animations play.
/// Touch events are forwarded to JS to drive interactive arm rotation.
struct AnimatedOnboardingSVG: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.isOpaque = false
        wv.backgroundColor = .clear
        wv.scrollView.backgroundColor = .clear
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.bounces = false
        // Allow touch passthrough for interaction
        wv.isUserInteractionEnabled = true
        // Load SVG
        if let url = Bundle.main.url(forResource: "onboarding-Vectorized", withExtension: "svg") {
            // Wrap SVG in minimal HTML for proper rendering + touch JS
            let html = Self.buildHTML(svgURL: url)
            wv.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
        }
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private static func buildHTML(svgURL: URL) -> String {
        let svgContent = (try? String(contentsOf: svgURL, encoding: .utf8)) ?? ""
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; }
          body { background: transparent; overflow: hidden; opacity: 0; transition: opacity 0.5s ease-out; }
          svg { width: 100%; height: auto; display: block; }
        </style>
        </head>
        <body onload="document.body.style.opacity=1">
        \(svgContent)
        <script>
        (function() {
          const ARMS = [
            { id: "right-arm1", sx: 482, sy: 381, rest: -10, min: -50, max: 10, dur: 2.4, phase: 0 },
            { id: "left-arm1",  sx: 428, sy: 384, rest: 0,   min: -10, max: 40, dur: 2.56, phase: 0.3 },
            { id: "right-arm2", sx: 1013, sy: 381, rest: 10,  min: -5, max: 25, dur: 2.4, phase: 0.5 },
            { id: "left-arm2",  sx: 927, sy: 383, rest: -10,  min: -25, max: 5, dur: 2.56, phase: 0.2 },
          ];

          var mode = "idle"; /* idle | spin | decel | spring */
          var idleStart = performance.now();

          function getArmEl(id) { return document.getElementById(id); }
          function setRot(el, angle, sx, sy) {
            el.setAttribute("transform", "rotate(" + angle + " " + sx + " " + sy + ")");
          }

          /* Remove SMIL on load — JS drives everything */
          ARMS.forEach(function(a) {
            var el = getArmEl(a.id);
            if (!el) return;
            var anim = el.querySelector("animateTransform");
            if (anim) el.removeChild(anim);
          });

          /* ── Idle: sine wave swing ── */
          function idleTick(ts) {
            if (mode !== "idle") return;
            ARMS.forEach(function(a) {
              var el = getArmEl(a.id);
              if (!el) return;
              var swing = (a.max - a.min) * 0.4;
              var t = ((ts - idleStart) / 1000 + a.phase) / a.dur;
              var angle = a.rest + Math.sin(t * Math.PI * 2) * swing * 0.5;
              setRot(el, angle, a.sx, a.sy);
            });
            requestAnimationFrame(idleTick);
          }
          requestAnimationFrame(idleTick);

          /* ── Spin state ── */
          var spinAngle = 0;
          var spinSpeed = 0;
          var MAX_SPIN = 2.16; /* 6 rev/s */
          var lastSpinTime = 0;

          function spinTick(ts) {
            if (mode !== "spin") return;
            var dt = ts - lastSpinTime;
            lastSpinTime = ts;
            spinSpeed = Math.min(MAX_SPIN, spinSpeed + dt * 0.005);
            spinAngle += dt * spinSpeed;
            var el1 = getArmEl("right-arm1");
            var el2 = getArmEl("left-arm1");
            if (el1) setRot(el1, spinAngle % 360, 482, 381);
            if (el2) setRot(el2, (spinAngle % 360), 428, 384);
            requestAnimationFrame(spinTick);
          }

          /* ── Decel → spring → idle ── */
          var decelStartTime, decelDur, decelInitSpeed;

          function decelTick(ts) {
            if (mode !== "decel") return;
            var elapsed = ts - decelStartTime;
            if (elapsed < decelDur) {
              var progress = elapsed / decelDur;
              var speed = decelInitSpeed * (1 - progress);
              var dt = ts - lastSpinTime;
              lastSpinTime = ts;
              spinAngle += dt * speed;
              var el1 = getArmEl("right-arm1");
              var el2 = getArmEl("left-arm1");
              if (el1) setRot(el1, spinAngle % 360, 482, 381);
              if (el2) setRot(el2, (spinAngle % 360), 428, 384);
              requestAnimationFrame(decelTick);
            } else {
              /* Capture current angles, start spring */
              mode = "spring";
              var snapAngles = ARMS.map(function(a) {
                var el = getArmEl(a.id);
                if (!el) return a.rest;
                var t = el.getAttribute("transform") || "";
                var m = t.match(/rotate\\(([\\-\\d.]+)/);
                return m ? parseFloat(m[1]) : a.rest;
              });
              var springStart = null;
              function springTick(ts2) {
                if (mode !== "spring") return;
                if (!springStart) springStart = ts2;
                var p = Math.min((ts2 - springStart) / 800, 1);
                var ease = 1 - Math.pow(2, -10 * p) * Math.cos(p * Math.PI * 3);
                ARMS.forEach(function(a, i) {
                  var el = getArmEl(a.id);
                  if (!el) return;
                  var cur = snapAngles[i] + (a.rest - snapAngles[i]) * ease;
                  setRot(el, cur, a.sx, a.sy);
                });
                if (p < 1) {
                  requestAnimationFrame(springTick);
                } else {
                  /* Seamlessly transition to idle from current time */
                  idleStart = ts2;
                  mode = "idle";
                  requestAnimationFrame(idleTick);
                }
              }
              requestAnimationFrame(springTick);
            }
          }

          /* ── Touch handlers ── */
          function onTouch(e) {
            e.preventDefault();
            if (mode === "idle" || mode === "spring") {
              mode = "spin";
              spinSpeed = 0;
              lastSpinTime = performance.now();
              /* Right person arms: drop to lowest */
              var r2 = getArmEl("right-arm2");
              var l2 = getArmEl("left-arm2");
              if (r2) setRot(r2, 25, 1013, 381);
              if (l2) setRot(l2, -25, 927, 383);
              requestAnimationFrame(spinTick);
            }
          }

          function onTouchEnd() {
            if (mode !== "spin") return;
            mode = "decel";
            decelInitSpeed = spinSpeed;
            decelDur = spinSpeed / 0.003;
            if (decelDur < 100) decelDur = 100;
            decelStartTime = performance.now();
            lastSpinTime = decelStartTime;
            requestAnimationFrame(decelTick);
          }

          document.addEventListener("touchstart", onTouch, { passive: false });
          document.addEventListener("touchmove", function(e) { e.preventDefault(); }, { passive: false });
          document.addEventListener("touchend", onTouchEnd);
          document.addEventListener("touchcancel", onTouchEnd);
        })();
        </script>
        </body>
        </html>
        """;
    }
}
