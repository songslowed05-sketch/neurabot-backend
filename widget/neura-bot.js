(function () {
  "use strict";

  const script =
    document.currentScript ||
    document.querySelector(
      'script[data-neura-business]'
    );

  if (!script) {
    console.error(
      "NeuraBot: Script tag not found."
    );
    return;
  }

  const businessId =
    script.getAttribute(
      "data-neura-business"
    );

  const apiUrl =
    script.getAttribute("data-neura-api") ||
    "http://localhost:5000";

  if (!businessId) {
    console.error(
      "NeuraBot: business ID is missing."
    );
    return;
  }

  /* ==================================================
     STYLES
  ================================================== */

  const style =
    document.createElement("style");

  style.textContent = `
    #neura-bot-button {
      position: fixed;
      right: 22px;
      bottom: 22px;
      width: 58px;
      height: 58px;
      border: none;
      border-radius: 50%;
      background: linear-gradient(
        135deg,
        #7c5cff,
        #5b8cff
      );
      color: white;
      cursor: pointer;
      z-index: 999999;
      box-shadow:
        0 10px 35px rgba(0,0,0,.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 25px;
      transition: .2s ease;
    }

    #neura-bot-button:hover {
      transform: translateY(-3px) scale(1.04);
    }

    #neura-bot-window {
      position: fixed;
      right: 22px;
      bottom: 92px;
      width: 350px;
      height: 500px;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      z-index: 999998;
      box-shadow:
        0 20px 60px rgba(0,0,0,.25);
      display: none;
      flex-direction: column;
      font-family:
        Inter,
        Arial,
        sans-serif;
    }

    #neura-bot-header {
      padding: 16px;
      background:
        linear-gradient(
          135deg,
          #7c5cff,
          #5b8cff
        );
      color: white;
      display: flex;
      align-items: center;
      gap: 11px;
    }

    .neura-bot-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(255,255,255,.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .neura-bot-title {
      flex: 1;
    }

    .neura-bot-title strong {
      display: block;
      font-size: 15px;
    }

    .neura-bot-title span {
      display: block;
      margin-top: 3px;
      font-size: 11px;
      opacity: .85;
    }

    #neura-bot-close {
      border: none;
      background: transparent;
      color: white;
      cursor: pointer;
      font-size: 22px;
    }

    #neura-bot-messages {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      background: #f7f8fc;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .neura-message {
      max-width: 82%;
      padding: 10px 13px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .neura-ai {
      align-self: flex-start;
      background: white;
      color: #20232d;
      border-bottom-left-radius: 5px;
      box-shadow:
        0 2px 8px rgba(0,0,0,.06);
    }

    .neura-user {
      align-self: flex-end;
      background: #7c5cff;
      color: white;
      border-bottom-right-radius: 5px;
    }

    .neura-typing {
      display: flex;
      gap: 4px;
      padding: 11px 13px;
      background: white;
      border-radius: 14px;
      width: fit-content;
      box-shadow:
        0 2px 8px rgba(0,0,0,.06);
    }

    .neura-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #8c8c98;
      animation:
        neuraTyping 1.2s infinite ease-in-out;
    }

    .neura-typing span:nth-child(2) {
      animation-delay: .15s;
    }

    .neura-typing span:nth-child(3) {
      animation-delay: .3s;
    }

    @keyframes neuraTyping {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: .45;
      }

      30% {
        transform: translateY(-5px);
        opacity: 1;
      }
    }

    #neura-bot-input-area {
      display: flex;
      padding: 10px;
      gap: 8px;
      background: white;
      border-top: 1px solid #ececf2;
    }

    #neura-bot-input {
      flex: 1;
      border: 1px solid #e1e2e8;
      outline: none;
      border-radius: 12px;
      padding: 11px 12px;
      font-size: 13px;
    }

    #neura-bot-send {
      width: 42px;
      border: none;
      border-radius: 12px;
      background: #7c5cff;
      color: white;
      cursor: pointer;
      font-size: 17px;
    }

    #neura-bot-send:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    .neura-disabled {
      padding: 20px;
      margin: auto;
      text-align: center;
      color: #666;
      font-size: 13px;
    }

    @media (max-width: 480px) {
      #neura-bot-window {
        right: 10px;
        bottom: 82px;
        width: calc(100vw - 20px);
        height: 70vh;
      }

      #neura-bot-button {
        right: 15px;
        bottom: 15px;
      }
    }
  `;

  document.head.appendChild(style);

  /* ==================================================
     BUTTON
  ================================================== */

  const button =
    document.createElement("button");

  button.id = "neura-bot-button";
  button.innerHTML = "✦";
  button.setAttribute(
    "aria-label",
    "Open NeuraBot"
  );

  document.body.appendChild(button);

  /* ==================================================
     CHAT WINDOW
  ================================================== */

  const windowBox =
    document.createElement("div");

  windowBox.id = "neura-bot-window";

  windowBox.innerHTML = `
    <div id="neura-bot-header">

      <div class="neura-bot-avatar">
        ✦
      </div>

      <div class="neura-bot-title">
        <strong>NeuraBot</strong>
        <span>AI Assistant</span>
      </div>

      <button
        id="neura-bot-close"
        type="button"
      >
        ×
      </button>

    </div>

    <div id="neura-bot-messages">

      <div class="neura-message neura-ai">
        Hi! 👋 How can I help you today?
      </div>

    </div>

    <form id="neura-bot-input-area">

      <input
        id="neura-bot-input"
        type="text"
        placeholder="Ask anything..."
        autocomplete="off"
      />

      <button
        id="neura-bot-send"
        type="submit"
      >
        ➤
      </button>

    </form>
  `;

  document.body.appendChild(windowBox);

  /* ==================================================
     ELEMENTS
  ================================================== */

  const closeButton =
    document.getElementById(
      "neura-bot-close"
    );

  const messagesBox =
    document.getElementById(
      "neura-bot-messages"
    );

  const form =
    document.getElementById(
      "neura-bot-input-area"
    );

  const input =
    document.getElementById(
      "neura-bot-input"
    );

  const sendButton =
    document.getElementById(
      "neura-bot-send"
    );

  /* ==================================================
     OPEN / CLOSE
  ================================================== */

  button.addEventListener(
    "click",
    function () {
      windowBox.style.display = "flex";
      button.style.display = "none";
      input.focus();
    }
  );

  closeButton.addEventListener(
    "click",
    function () {
      windowBox.style.display = "none";
      button.style.display = "flex";
    }
  );

  /* ==================================================
     ADD MESSAGE
  ================================================== */

  function addMessage(
    text,
    type
  ) {
    const message =
      document.createElement("div");

    message.className =
      "neura-message " +
      (type === "user"
        ? "neura-user"
        : "neura-ai");

    message.textContent = text;

    messagesBox.appendChild(message);

    messagesBox.scrollTop =
      messagesBox.scrollHeight;
  }

  /* ==================================================
     TYPING
  ================================================== */

  function showTyping() {
    const typing =
      document.createElement("div");

    typing.className =
      "neura-typing";

    typing.id =
      "neura-typing";

    typing.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    messagesBox.appendChild(typing);

    messagesBox.scrollTop =
      messagesBox.scrollHeight;
  }

  function hideTyping() {
    const typing =
      document.getElementById(
        "neura-typing"
      );

    if (typing) {
      typing.remove();
    }
  }

  /* ==================================================
     SEND MESSAGE
  ================================================== */

  async function sendMessage(
    message
  ) {
    if (!message || !message.trim()) {
      return;
    }

    addMessage(
      message.trim(),
      "user"
    );

    input.value = "";

    input.disabled = true;
    sendButton.disabled = true;

    showTyping();

    try {

      const response =
        await fetch(
          apiUrl +
            "/api/widget/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              businessId:
                businessId,

              message:
                message.trim(),
            }),
          }
        );

      const data =
        await response.json();

      hideTyping();

      if (!response.ok) {

        addMessage(
          data.message ||
            "The chatbot is currently unavailable.",
          "ai"
        );

        return;
      }

      addMessage(
        data.answer ||
          "Sorry, I couldn't generate a response.",
        "ai"
      );

    } catch (error) {

      console.error(
        "NeuraBot error:",
        error
      );

      hideTyping();

      addMessage(
        "Sorry, I'm temporarily unavailable. Please try again.",
        "ai"
      );

    } finally {

      input.disabled = false;
      sendButton.disabled = false;

      input.focus();
    }
  }

  /* ==================================================
     FORM SUBMIT
  ================================================== */

  form.addEventListener(
    "submit",
    function (event) {
      event.preventDefault();

      sendMessage(
        input.value
      );
    }
  );

})();