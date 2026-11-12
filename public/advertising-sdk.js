
(function (window) {
  "use strict";

  const AD_NETWORK_ORIGIN =
    "https://scam-gamma.vercel.app";

  const AdvertisingSDK = {

    init: async function (options = {}) {

      const container =
        typeof options.container === "string"
          ? document.querySelector(options.container)
          : null;

      if (!container) {
        return {
          success: false,
          message: "Advertising container not found."
        };
      }

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

      // Validate credentials
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

      // Create iframe
      const iframe = document.createElement("iframe");

      iframe.src = AD_NETWORK_ORIGIN + "/ad-gui.html";
      iframe.title = "Advertising Platform";
      iframe.style.width = "100%";
      iframe.style.height = "320px";
      iframe.style.border = "none";
      iframe.referrerPolicy = "no-referrer";

      try {

        const result = await new Promise((resolve, reject) => {

          let credentialsSent = false;
          let initSettled = false;
          let timeout = null;
          let cleaned = false;

          // Clean up listener and timeout
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

          // Resolve initial loading result.
          // IMPORTANT: Keep the listener active after this.
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

            iframe.remove();
            cleanup();

            if (initSettled) {
              console.error("Advertising SDK:", error.message);
              return;
            }

            initSettled = true;

            reject(error);
          };

          // Listen for GUI messages
          const handleMessage = (event) => {

            // Verify message origin and iframe
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

            // GUI is ready
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

            if (data.type !== "AD_NETWORK_STATUS") {
              return;
            }

            // GUI reports that the ad was closed
            if (data.status === "closed") {

              iframe.remove();

              cleanup();

              // Handle closure before initial loading finishes
              if (!initSettled) {

                initSettled = true;

                resolve({
                  success: true,
                  closed: true,
                  message: "Advertisement was closed."
                });
              }

              // Notify partner application
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

            // Advertisement successfully loaded
            if (
              data.status === "loaded" ||
              data.status === "no_ad"
            ) {

              finishSuccess({
                success: true,
                noAd: data.status === "no_ad",
                message:
                  data.message ||
                  "Advertising processed successfully."
              });

              return;
            }

            // Authorization or loading failed
            if (data.status === "error") {

              finishError(
                new Error(
                  data.message ||
                  "Advertising authorization failed."
                )
              );
            }
          };

          // Register listener before inserting iframe
          window.addEventListener(
            "message",
            handleMessage
          );

          // Verification timeout
          timeout = setTimeout(() => {

            finishError(
              new Error(
                "Advertising GUI verification timed out."
              )
            );

          }, 30000);

          // Insert iframe
          container.replaceChildren(iframe);

        });

        return result;

      } catch (error) {

        iframe.remove();

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
