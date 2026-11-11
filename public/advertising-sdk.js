
(function (window) {

    const AdvertisingSDK = {

        init: function (options = {}) {

            const container = document.querySelector(
                options.container
            );

            if (!container) {
                console.error(
                    "Advertising SDK: Container not found."
                );
                return;
            }

            // Create iframe
            const iframe = document.createElement("iframe");

            // Load your hosted GUI
            iframe.src =
                "https://scam-gamma.vercel.app/ad-gui.html";

            iframe.style.width = "100%";
            iframe.style.height = "250px";
            iframe.style.border = "none";

            iframe.setAttribute(
                "title",
                "Advertising Platform"
            );

            // Display GUI
            container.appendChild(iframe);
        }

    };

    window.AdvertisingSDK = AdvertisingSDK;

})(window);
