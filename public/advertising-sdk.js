(function (window) {

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

      if (!/^[a-f0-9]{64}$/i.test(token_id)) {
        return {
          success: false,
          message: "Invalid token ID."
        };
      }

      if (!/^[A-F0-9]{8}$/.test(subid)) {
        return {
          success: false,
          message: "Invalid application subid."
        };
      }

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

          const cleanup = () => {
            window.removeEventListener("message", handleMessage);
            clearTimeout(timeout);
          };

          const finish = (callback, value) => {
            if (completed) return;
            completed = true;
            cleanup();
            callback(value);
          };

          const handleMessage = (event) => {

            // Only accept messages from this advertising iframe.
            if (
              event.origin !== AD_NETWORK_ORIGIN ||
              event.source !== iframe.contentWindow
            ) {
              return;
            }

            const message = event.data;

            if (!message || typeof message !== "object") {
              return;
            }

            // GUI is ready. Now send both credentials.
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

            // Receive verification and ad-loading result.
            if (message.type !== "AD_NETWORK_STATUS") {
              return;
            }

            if (
              message.status === "loaded" ||
              message.status === "no_ad"
            ) {
              finish(resolve, {
                success: true,
                noAd: message.status === "no_ad",
                message: message.message
              });
            } else if (message.status === "error") {
              finish(reject, new Error(
                message.message || "Advertising authorization failed."
              ));
            }
          };

          window.addEventListener("message", handleMessage);

          const timeout = setTimeout(() => {
            finish(
              reject,
              new Error("Advertising GUI verification timed out.")
            );
          }, 30000);

          // Insert iframe after registering the message listener.
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
