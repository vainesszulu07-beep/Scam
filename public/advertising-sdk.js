
(function (window) {

    const AdvertisingSDK = {

        init: async function (options = {}) {

            const container = document.querySelector(
                options.container
            );

            if (!container) {
                console.error(
                    "Advertising SDK: Container not found."
                );
                return;
            }

            // STEP 1: Get token supplied by publisher
            const token_id =
                typeof options.token_id === "string"
                    ? options.token_id.trim()
                    : "";

            if (!token_id) {
                console.error(
                    "Advertising SDK: Token ID is required."
                );
                return;
            }

            try {

                // STEP 2: Verify token with your backend
                const response = await fetch(
                    "https://scam-gamma.vercel.app/api/verify-token",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            token_id: token_id
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
                    console.error(
                        "Advertising SDK: Authorization failed.",
                        result.message
                    );

                    return;
                }

                console.log(
                    "Advertising SDK: Partner authenticated."
                );

                // STEP 4: Create advertising iframe
                const iframe = document.createElement("iframe");

                iframe.src =
                    "https://scam-gamma.vercel.app/ad-gui.html";

                iframe.style.width = "100%";
                iframe.style.height = "250px";
                iframe.style.border = "none";

                iframe.setAttribute(
                    "title",
                    "Advertising Platform"
                );

                container.appendChild(iframe);

                console.log(
                    "Advertising SDK: Advertisement loaded."
                );

            } catch (error) {

                console.error(
                    "Advertising SDK: Verification server unavailable.",
                    error.message
                );

            }

        }

    };

    window.AdvertisingSDK = AdvertisingSDK;

})(window);
