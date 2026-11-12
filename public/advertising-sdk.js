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

      // STEP 1: Get credentials
      const token_id =
        typeof options.token_id === "string"
          ? options.token_id.trim()
          : "";

      const subid =
        typeof options.subid === "string"
          ? options.subid.trim()
          : "";

      // STEP 2: Validate credentials
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

      // STEP 3: Create advertising iframe
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
          let completed = false;
          let timeout;

          // Remove event listener and timeout
          const cleanup = () => {
            window.removeEventListener(
              "message",
              handleMessage
            );

            clearTimeout(timeout);
          };

          // Finish only once
          const finish = (callback, value) => {

            if (completed) return;

            completed = true;

            cleanup();

            callback(value);
          };

          // STEP 4: Receive messages from advertising GUI
          const handleMessage = (event) => {

            // Confirm the message came from our advertising iframe
            if (
              event.origin !== AD_NETWORK_ORIGIN ||
              event.source !== iframe.contentWindow
            ) {
              return;
            }

            const message = event.data;

            if (
              !message ||
              typeof message !== "object"
            ) {
              return;
            }

            // STEP 5: GUI is ready. Send credentials.
            if (
              message.type === "AD_NETWORK_READY" &&
              !credentialsSent
            ) {

              credentialsSent = true;

              iframe.contentWindow.postMessage(
                {
                  type: "AD_NETWORK_INIT",
                  token_id: token_id,
                  subid: subid
                },
                AD_NETWORK_ORIGIN
              );

              return;
            }

            // STEP 6: Receive advertising status
            if (
              message.type !== "AD_NETWORK_STATUS"
            ) {
              return;
            }

            // Advertisement successfully loaded
            if (
              message.status === "loaded" ||
              message.status === "no_ad"
            ) {

              finish(resolve, {
                success: true,
                noAd: message.status === "no_ad",
                message:
                  message.message ||
                  "Advertising processed successfully."
              });

              return;
            }

            // Advertising verification or loading failed
            if (message.status === "error") {

              finish(
                reject,
                new Error(
                  message.message ||
                  "Advertising authorization failed."
                )
              );

            }
          };

          // STEP 7: Register listener before inserting iframe
          window.addEventListener(
            "message",
            handleMessage
          );

          // STEP 8: Set verification timeout
          timeout = setTimeout(() => {

            finish(
              reject,
              new Error(
                "Advertising GUI verification timed out."
              )
            );

          }, 30000);

          // STEP 9: Load iframe
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

  // STEP 10: Expose SDK globally
  window.AdvertisingSDK = AdvertisingSDK;

})(window);
