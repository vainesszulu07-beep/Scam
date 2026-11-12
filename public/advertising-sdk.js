
(function (window) {
  "use strict";

  const AD_NETWORK_ORIGIN =
    "https://scam-gamma.vercel.app";

  const VALID_PLACEMENTS = [
    "bottom",
    "top",
    "static",
    "fullscreen"
  ];

  const AdvertisingSDK = {

    init: async function (options = {}) {

      // STEP 1: Read placement
      const placement =
        typeof options.placement === "string"
          ? options.placement.trim().toLowerCase()
          : "static";

      if (!VALID_PLACEMENTS.includes(placement)) {
        return {
          success: false,
          message: "Invalid advertising placement."
        };
      }

      // STEP 2: Find container only for static placement
      let container = null;

      if (placement === "static") {

        container =
          typeof options.container === "string"
            ? document.querySelector(options.container)
            : null;

        if (!container) {
          return {
            success: false,
            message: "Advertising container not found."
          };
        }
      }

      if (!document.body) {
        return {
          success: false,
          message: "Document body is not available."
        };
      }

      // STEP 3: Validate credentials
      const token_id =
        typeof options.token_id === "string"
          ? options.token_id.trim()
          : "";

      const subid =
        typeof options.subid === "string"
          ? options.subid.trim()
          : "";

      const onClose =
        typeof options.onClose === "function"
          ? options.onClose
          : null;

      if (!/^[a-f0-9]{64}$/i.test(token_id)) {
        return {
          success: false,
          message: "Invalid authentication token."
        };
      }

      if (!/^[A-F0-9]{8}$/.test(subid)) {
        return {
          success: false,
          message: "Invalid application subid."
        };
      }

      // STEP 4: Create wrapper
      const wrapper = document.createElement("div");

      wrapper.setAttribute(
        "data-ad-network-placement",
        placement
      );

      wrapper.style.boxSizing = "border-box";
      wrapper.style.overflow = "hidden";
      wrapper.style.background = "#ffffff";

      // STEP 5: Configure placement
      if (placement === "static") {

        wrapper.style.position = "relative";
        wrapper.style.width = "100%";
        wrapper.style.minHeight = "320px";

      }

      else if (
        placement === "bottom" ||
        placement === "top"
      ) {

        wrapper.style.position = "fixed";
        wrapper.style.left = "50%";
        wrapper.style.width = "min(600px, calc(100vw - 24px))";
        wrapper.style.height = "320px";
        wrapper.style.zIndex = "2147483647";
        wrapper.style.borderRadius = "12px";
        wrapper.style.boxShadow =
          "0 8px 35px rgba(0,0,0,0.22)";
        
        wrapper.style.transform = "translateX(-50%)";

        if (placement === "bottom") {
          wrapper.style.bottom = "12px";
        } else {
          wrapper.style.top = "12px";
        }
      }

      else if (placement === "fullscreen") {

        wrapper.style.position = "fixed";
        wrapper.style.inset = "0";
        wrapper.style.width = "100vw";
        wrapper.style.height = "100vh";
        wrapper.style.height = "100dvh";
        wrapper.style.zIndex = "2147483647";
        wrapper.style.background = "rgba(0,0,0,0.75)";
        wrapper.style.borderRadius = "0";
      }

      // STEP 6: Create advertising iframe
      const iframe = document.createElement("iframe");

      iframe.src = AD_NETWORK_ORIGIN + "/ad-gui.html";
      iframe.title = "Advertising Platform";
      iframe.style.display = "block";
      iframe.style.width = "100%";
      iframe.style.height =
        placement === "fullscreen"
          ? "100%"
          : "320px";

      iframe.style.border = "none";
      iframe.referrerPolicy = "no-referrer";

      iframe.setAttribute(
        "allow",
        "autoplay"
      );

      wrapper.appendChild(iframe);

      // Save original scroll setting for fullscreen
      const originalOverflow =
        document.documentElement.style.overflow;

      let scrollLocked = false;

      const restoreScroll = () => {
        if (scrollLocked) {
          document.documentElement.style.overflow =
            originalOverflow;

          scrollLocked = false;
        }
      };

      if (placement === "fullscreen") {
        document.documentElement.style.overflow = "hidden";
        scrollLocked = true;
      }

      // STEP 7: Mount the wrapper
      if (placement === "static") {
        container.replaceChildren(wrapper);
      } else {
        document.body.appendChild(wrapper);
      }

      try {

        const result = await new Promise((resolve, reject) => {

          let credentialsSent = false;
          let initSettled = false;
          let timeout = null;
          let cleaned = false;

          const removeAd = () => {
            wrapper.remove();
            restoreScroll();
          };

          // Remove message listener and timeout
          const cleanup = () => {

            if (cleaned) return;

            cleaned = true;

            window.removeEventListener(
              "message",
              handleMessage
            );

            if (timeout !== null) {
              clearTimeout(timeout);
              timeout = null;
            }
          };

          // Successfully loaded
          const finishSuccess = (value) => {

            if (initSettled) return;

            initSettled = true;

            if (timeout !== null) {
              clearTimeout(timeout);
              timeout = null;
            }

            resolve(value);
          };

          // Handle errors
          const finishError = (error) => {

            removeAd();
            cleanup();

            if (initSettled) {
              console.error(
                "Advertising SDK:",
                error.message
              );
              return;
            }

            initSettled = true;
            reject(error);
          };

          // STEP 8: Listen for GUI messages
          const handleMessage = (event) => {

            if (
              event.origin !== AD_NETWORK_ORIGIN ||
              event.source !== iframe.contentWindow
            ) {
              return;
            }

            const data = event.data;

            if (
              !data ||
              typeof data !== "object"
            ) {
              return;
            }

            // GUI ready: send credentials
            if (
              data.type === "AD_NETWORK_READY" &&
              !credentialsSent
            ) {

              credentialsSent = true;

              iframe.contentWindow.postMessage(
                {
                  type: "AD_NETWORK_INIT",
                  token_id,
                  subid
                },
                AD_NETWORK_ORIGIN
              );

              return;
            }

            if (
              data.type !== "AD_NETWORK_STATUS"
            ) {
              return;
            }

            // STEP 9: User closes advertisement
            if (data.status === "closed") {

              removeAd();
              cleanup();

              if (!initSettled) {

                initSettled = true;

                resolve({
                  success: true,
                  closed: true,
                  message: "Advertisement was closed."
                });
              }

              if (onClose) {
                try {
                  onClose();
                } catch (error) {
                  console.error(
                    "Advertising SDK onClose:",
                    error
                  );
                }
              }

              return;
            }

            // STEP 10: Advertisement loaded
            if (data.status === "loaded") {

              finishSuccess({
                success: true,
                noAd: false,
                placement,
                message:
                  data.message ||
                  "Advertisement loaded successfully."
              });

              return;
            }

            // No advertisement available
            if (data.status === "no_ad") {

              removeAd();
              cleanup();

              finishSuccess({
                success: true,
                noAd: true,
                placement,
                message:
                  data.message ||
                  "No advertisements available."
              });

              return;
            }

            // Authorization or loading error
            if (data.status === "error") {

              finishError(
                new Error(
                  data.message ||
                  "Advertising authorization failed."
                )
              );
            }
          };

          // STEP 11: Register listener
          window.addEventListener(
            "message",
            handleMessage
          );

          // STEP 12: Verification timeout
          timeout = setTimeout(() => {

            finishError(
              new Error(
                "Advertising GUI verification timed out."
              )
            );

          }, 30000);

        });

        return result;

      } catch (error) {

        wrapper.remove();
        restoreScroll();

        console.error(
          "Advertising SDK:",
          error.message
        );

        return {
          success: false,
          message: error.message
        };
      }
    }
  };

  window.AdvertisingSDK = AdvertisingSDK;

})(window);
