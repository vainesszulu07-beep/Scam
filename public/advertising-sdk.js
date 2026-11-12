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

      // STEP 1: Get credentials from publisher
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

      try {

        // STEP 2: Verify token and subid together
        const response = await fetch(
          AD_NETWORK_ORIGIN + "/api/verify-token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              token_id: token_id,
              subid: subid
            }),
            cache: "no-store",
            credentials: "omit"
          }
        );

        const result = await response.json();

        // STEP 3: Reject unauthorized applications
        if (
          !response.ok ||
          result.authorized !== true
        ) {
          return {
            success: false,
            message:
              result.message || "Authorization failed."
          };
        }

        console.log(
          "Advertising SDK: Application authenticated."
        );

        // STEP 4: Load advertising GUI
        const iframe = document.createElement("iframe");

        iframe.src =
          AD_NETWORK_ORIGIN + "/ad-gui.html";

        iframe.style.width = "100%";
        iframe.style.height = "250px";
        iframe.style.border = "none";

        iframe.setAttribute(
          "title",
          "Advertising Platform"
        );

        container.replaceChildren(iframe);

        return {
          success: true,
          message: "Advertising GUI loaded."
        };

      } catch (error) {

        console.error(
          "Advertising SDK error:",
          error.message
        );

        return {
          success: false,
          message: "Verification server unavailable."
        };
      }
    }

  };

  window.AdvertisingSDK = AdvertisingSDK;

})(window);
