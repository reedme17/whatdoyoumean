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
          let returnTimer = null;

          function getArmEl(id) { return document.getElementById(id); }

          function setRotation(el, angle, sx, sy) {
            el.setAttribute("transform", "rotate(" + angle + " " + sx + " " + sy + ")");
          }

          function onTouch(e) {
            e.preventDefault();
            const touch = e.touches[0];
            if (!touch) return;
            const svg = document.querySelector("svg");
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const scaleX = 1408 / rect.width;
            const scaleY = 768 / rect.height;
            const mx = (touch.clientX - rect.left) * scaleX;
            const my = (touch.clientY - rect.top) * scaleY;

            if (!interacting) {
              interacting = true;
              // Pause CSS animations
              ARMS.forEach(function(a) {
                var el = getArmEl(a.id);
                if (el) el.style.animation = "none";
              });
            }
            if (returnTimer) { clearTimeout(returnTimer); returnTimer = null; }

            ARMS.forEach(function(a) {
              var el = getArmEl(a.id);
              if (!el) return;
              var angle = Math.atan2(my - a.sy, mx - a.sx) * (180 / Math.PI);
              var target = Math.max(a.min, Math.min(a.max, angle * 0.15));
              setRotation(el, target, a.sx, a.sy);
            });
          }

          function onTouchEnd() {
            if (!interacting) return;
            // Spring back: animate to rest over 600ms
            var startTime = null;
            var startAngles = ARMS.map(function(a) {
              var el = getArmEl(a.id);
              if (!el) return a.rest;
              var t = el.getAttribute("transform") || "";
              var m = t.match(/rotate\\(([\\-\\d.]+)/);
              return m ? parseFloat(m[1]) : a.rest;
            });

            function animate(ts) {
              if (!startTime) startTime = ts;
              var progress = Math.min((ts - startTime) / 600, 1);
              // Elastic ease out approximation
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
                // Resume CSS animations
                ARMS.forEach(function(a) {
                  var el = getArmEl(a.id);
                  if (el) el.style.animation = "";
                });
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
