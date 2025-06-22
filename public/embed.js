(function () {
  const userId = document.currentScript.getAttribute("data-user") || "demo-user";

  if (document.getElementById("my-bot-widget")) return;

  const container = document.createElement("div");
  container.id = "my-bot-widget";
  container.style.position = "fixed";
  container.style.bottom = "20px";
  container.style.right = "20px";
  container.style.width = "380px";
  container.style.height = "600px";
  container.style.zIndex = "9999";
  container.style.borderRadius = "16px";
  container.style.boxShadow = "0 2px 12px rgba(0,0,0,0.2)";
  container.style.overflow = "hidden";

  const iframe = document.createElement("iframe");
  iframe.src = `https://in60second.net/bot?uid=${userId}`;
  iframe.width = "100%";
  iframe.height = "100%";
  iframe.style.border = "0";

  container.appendChild(iframe);
  document.body.appendChild(container);
})();
