(function() {
  if (window.FuturePay) return;

  const DEFAULT_CHECKOUT_ORIGIN = "https://cmsv01-bank-ops-web-kumar-gaurav-s-projects.vercel.app";

  window.FuturePay = {
    checkout: function(options) {
      const { sessionId, containerId, checkoutUrl, layout, onCompleted, onCancelled } = options;

      // Determine where the checkout iframe should point
      let targetUrl = checkoutUrl;
      if (!targetUrl) {
        const origin = window.location.origin.includes("localhost") 
          ? "http://localhost:3002" 
          : DEFAULT_CHECKOUT_ORIGIN;
        targetUrl = `${origin}/checkout/${sessionId}`;
      }

      // Parse the origin to validate messages
      const urlObj = new URL(targetUrl);
      const checkoutOrigin = urlObj.origin;

      let backdropEl = null;
      let sideSheetEl = null;
      let iframeContainer = null;
      let closeControl = null;

      // Create iframe
      const iframe = document.createElement("iframe");
      iframe.src = `${targetUrl}?embed=true`;
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allowtransparency", "true");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.background = "#FFFFFF";

      if (layout === "sidesheet") {
        // 1. Create Backdrop
        backdropEl = document.createElement("div");
        backdropEl.style.position = "fixed";
        backdropEl.style.top = "0";
        backdropEl.style.left = "0";
        backdropEl.style.width = "100%";
        backdropEl.style.height = "100%";
        backdropEl.style.backgroundColor = "rgba(15, 23, 42, 0.4)";
        backdropEl.style.backdropFilter = "blur(4px)";
        backdropEl.style.webkitBackdropFilter = "blur(4px)";
        backdropEl.style.zIndex = "99999";
        backdropEl.style.opacity = "0";
        backdropEl.style.transition = "opacity 0.3s ease";

        // 2. Create Side Sheet Container
        sideSheetEl = document.createElement("div");
        sideSheetEl.style.position = "fixed";
        sideSheetEl.style.top = "0";
        sideSheetEl.style.right = "0";
        sideSheetEl.style.width = "460px";
        sideSheetEl.style.maxWidth = "100%";
        sideSheetEl.style.height = "100%";
        sideSheetEl.style.backgroundColor = "#FFFFFF";
        sideSheetEl.style.zIndex = "100000";
        sideSheetEl.style.boxShadow = "-4px 0 24px rgba(15, 23, 42, 0.15)";
        sideSheetEl.style.transform = "translateX(100%)";
        sideSheetEl.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
        sideSheetEl.style.display = "flex";
        sideSheetEl.style.flexDirection = "column";

        // 3. Create Side Sheet Header
        const header = document.createElement("div");
        header.style.padding = "16px 24px";
        header.style.borderBottom = "1px solid #F1F5F9";
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";

        const title = document.createElement("span");
        title.innerText = "Payment Checkout";
        title.style.fontWeight = "600";
        title.style.color = "#0F172A";
        title.style.fontFamily = "Inter, -apple-system, sans-serif";
        title.style.fontSize = "16px";

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&#x2715;"; // Multiplication sign (X)
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.fontSize = "18px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.color = "#64748B";
        closeBtn.style.padding = "4px";
        closeBtn.style.display = "flex";
        closeBtn.style.alignItems = "center";
        closeBtn.style.justifyContent = "center";
        closeBtn.style.transition = "color 0.15s";
        closeBtn.onmouseenter = () => closeBtn.style.color = "#0F172A";
        closeBtn.onmouseleave = () => closeBtn.style.color = "#64748B";
        closeBtn.onclick = () => handleClose(true);

        header.appendChild(title);
        header.appendChild(closeBtn);
        sideSheetEl.appendChild(header);

        // 4. Create Iframe Wrapper inside side sheet
        iframeContainer = document.createElement("div");
        iframeContainer.style.flex = "1";
        iframeContainer.style.width = "100%";
        iframeContainer.style.overflow = "hidden";
        iframeContainer.appendChild(iframe);
        sideSheetEl.appendChild(iframeContainer);

        // Append to DOM
        document.body.appendChild(backdropEl);
        document.body.appendChild(sideSheetEl);

        // Backdrop click to cancel
        backdropEl.onclick = (e) => {
          if (e.target === backdropEl) {
            handleClose(true);
          }
        };

        // Trigger slide-in animations
        requestAnimationFrame(() => {
          backdropEl.style.opacity = "1";
          sideSheetEl.style.transform = "translateX(0)";
        });

      } else {
        // Embed layout
        iframe.style.borderRadius = "12px";
        iframe.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
        iframe.style.height = "620px";

        const container = containerId 
          ? document.getElementById(containerId) 
          : document.body;

        if (!container) {
          console.error(`FuturePay SDK: Container with id "${containerId}" not found.`);
          return;
        }
        container.appendChild(iframe);
      }

      // Close handler to slide out and clean up
      function handleClose(wasCancelled, payload) {
        window.removeEventListener("message", handleMessage);

        if (layout === "sidesheet") {
          // Slide out
          if (backdropEl) backdropEl.style.opacity = "0";
          if (sideSheetEl) sideSheetEl.style.transform = "translateX(100%)";

          setTimeout(() => {
            if (backdropEl && backdropEl.parentNode) backdropEl.parentNode.removeChild(backdropEl);
            if (sideSheetEl && sideSheetEl.parentNode) sideSheetEl.parentNode.removeChild(sideSheetEl);
            
            if (wasCancelled && onCancelled) {
              onCancelled(payload);
            } else if (!wasCancelled && onCompleted) {
              onCompleted(payload);
            }
          }, 300);
        } else {
          // Embed cleanup
          iframe.remove();
          if (wasCancelled && onCancelled) {
            onCancelled(payload);
          } else if (!wasCancelled && onCompleted) {
            onCompleted(payload);
          }
        }
      }

      // Listen for events from checkout iframe
      function handleMessage(event) {
        if (event.origin !== checkoutOrigin) return;

        const data = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "PAYMENT_SUCCESS") {
          handleClose(false, data.payload);
        } else if (data.type === "PAYMENT_CANCELLED") {
          handleClose(true, data.payload);
        }
      }

      window.addEventListener("message", handleMessage);

      // Return a control object
      closeControl = {
        close: function() {
          handleClose(true);
        }
      };

      return closeControl;
    }
  };
})();
