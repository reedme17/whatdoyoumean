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
          body { background: transparent; overflow: hidden; }
          svg { width: 100%; height: auto; display: block; }
        </style>
        </head>
        <body>
        \(svgContent)
        <script>
        (function() {
          const ARMS = [
            { id: "right-arm1", sx: 482, sy: 381, rest: -10, min: -50, max: 10 },
            { id: "left-arm1",  sx: 428, sy: 384, rest: 0,   min: -10, max: 40 },
            { id: "right-arm2", sx: 1013, sy: 381, rest: 10,  min: -5, max: 25 },
            { id: "left-arm2",  sx: 927, sy: 383, rest: -10,  min: -25, max: 5 },
          ];

          let interacting = false;
          /* Store removed animateTransform elements so we can re-insert them */
          let savedAnims = {};

          function getArmEl(id) { return document.getElementById(id); }

          function setRotation(el, angle, sx, sy) {
            el.setAttribute("transform", "rotate(" + angle + " " + sx + " " + sy + ")");
          }

          /* Remove SMIL animateTransform from arm elements only */
          function removeArmAnims() {
            ARMS.forEach(function(a) {
              var el = getArmEl(a.id);
              if (!el) return;
              var anim = el.querySelector("animateTransform");
              if (anim) {
                savedAnims[a.id] = { parent: el, node: anim };
                el.removeChild(anim);
              }
              /* Clear any residual SMIL transform */
              el.removeAttribute("transform");
            });
          }

          /* Re-insert saved SMIL animateTransform elements */
          function restoreArmAnims() {
            Object.keys(savedAnims).forEach(function(id) {
              var info = savedAnims[id];
              if (info && info.parent && info.node) {
                /* Reset transform before re-adding animation */
                info.parent.removeAttribute("transform");
                info.parent.appendChild(info.node);
              }
            });
            savedAnims = {};
          }

          /* Left person arms spin fast, right person arms drop to lowest position */
          var spinAngle = 0;
          var spinRAF = null;
          var lastSpinTime = 0;

          function startSpin() {
            lastSpinTime = performance.now();
            function tick(ts) {
              var dt = ts - lastSpinTime;
              lastSpinTime = ts;
              spinAngle += dt * 0.5; /* ~180 deg per second */
              /* Left person: right-arm1 and left-arm1 */
              var el1 = getArmEl("right-arm1");
              var el2 = getArmEl("left-arm1");
              if (el1) setRotation(el1, spinAngle % 360, 482, 381);
              if (el2) setRotation(el2, -(spinAngle % 360), 428, 384);
              spinRAF = requestAnimationFrame(tick);
            }
            spinRAF = requestAnimationFrame(tick);
          }

          function stopSpin() {
            if (spinRAF) { cancelAnimationFrame(spinRAF); spinRAF = null; }
          }

          function onTouch(e) {
            e.preventDefault();
            if (!interacting) {
              interacting = true;
              removeArmAnims();
              /* Right person arms: drop to lowest position */
              var r2 = getArmEl("right-arm2");
              var l2 = getArmEl("left-arm2");
              if (r2) setRotation(r2, 25, 1013, 381);  /* max = lowest */
              if (l2) setRotation(l2, -25, 927, 383);  /* min = lowest */
              /* Left person arms: start spinning */
              startSpin();
            }
          }

          function onTouchEnd() {
            if (!interacting) return;
            stopSpin();

            /* Capture current angles for spring-back */
            var startAngles = ARMS.map(function(a) {
              var el = getArmEl(a.id);
              if (!el) return a.rest;
              var t = el.getAttribute("transform") || "";
              var m = t.match(/rotate\\(([\\-\\d.]+)/);
              return m ? parseFloat(m[1]) : a.rest;
            });
            var startTime = null;

            function animate(ts) {
              if (!startTime) startTime = ts;
              var progress = Math.min((ts - startTime) / 800, 1);
              var t = 1 - Math.pow(2, -10 * progress) * Math.cos(progress * Math.PI * 3);
              ARMS.forEach(function(a, i) {
                var el = getArmEl(a.id);
                if (!el) return;
                var current = startAngles[i] + (a.rest - startAngles[i]) * t;
                setRotation(el, current, a.sx, a.sy);
              });
              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                restoreArmAnims();
                interacting = false;
              }
            }
            requestAnimationFrame(animate);
          }

          document.addEventListener("touchstart", onTouch, { passive: false });
          document.addEventListener("touchmove", onTouch, { passive: false });
          document.addEventListener("touchend", onTouchEnd);
          document.addEventListener("touchcancel", onTouchEnd);
        })();
        </script>
        </body>
        </html>
        """;
    }
}
