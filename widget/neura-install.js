(function () {
  "use strict";

  const script = document.currentScript;

  if (!script) {
    console.error("NeuraBot: installation script not found.");
    return;
  }

  const businessId =
    script.getAttribute("data-business-id");

  const apiUrl =
    script.getAttribute("data-api") ||
    "http://localhost:5000";

  if (!businessId) {
    console.error(
      "NeuraBot: data-business-id is required."
    );
    return;
  }

  const widgetScript =
    document.createElement("script");

  widgetScript.src =
    apiUrl + "/widget/neura-widget.js";

  widgetScript.setAttribute(
    "data-business-id",
    businessId
  );

  widgetScript.setAttribute(
    "data-api",
    apiUrl
  );

  widgetScript.async = true;

  document.head.appendChild(widgetScript);
})();