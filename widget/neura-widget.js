(function () {
  "use strict";

  const script =
    document.currentScript;

  const businessId =
    script?.getAttribute("data-business-id");

  const apiUrl =
    script?.getAttribute("data-api") ||
    "http://localhost:5000";

  if (!businessId) {
    console.error(
      "NeuraBot: data-business-id is required."
    );
    return;
  }

  /* ==============================
     STYLES
  ============================== */

  const style =
    document.createElement("style");

  style.textContent = `
    #neurabot-button {
      position: fixed;
      right: 22px;
      bottom: 22px;
      width: 58px;
      height: 58px;
      border: none;
      border-radius: 50%;
      background: linear-gradient(135deg,#7c5cff,#5cdcff);
      color: white;
      font-size: 25px;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 12px 35px rgba(0,0,0,.25);
    }

    #neurabot-window {
      position: fixed;
      right: 22px;
      bottom: 92px;
      width: 350px;
      height: 500px;
      background: #0b1020;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 18px;
      overflow: hidden;
      z-index: 999999;
      display: none;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,.35);
      font-family: Arial,sans-serif;
    }

    #neurabot-header {
      padding: 16px;
      background: linear-gradient(
        135deg,
        #151b32,
        #11182b
      );
      color: white;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    #neurabot-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(
        135deg,
        #7c5cff,
        #5cdcff
      );
    }

    #neurabot-title {
      font-size: 15px;
      font-weight: 700;
    }

    #neurabot-status {
      font-size: 11px;
      color: #7ee787;
      margin-top: 3px;
    }

    #neurabot-messages {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .neurabot-message {
      max-width: 82%;
      padding: 10px 13px;
      border-radius: 13px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .neurabot-ai {
      align-self: flex-start;
      background: #171e34;
      color: #e9edff;
      border-bottom-left-radius: 4px;
    }

    .neurabot-user {
      align-self: flex-end;
      background: linear-gradient(
        135deg,
        #7c5cff,
        #5c8cff
      );
      color: white;
      border-bottom-right-radius: 4px;
    }

    #neurabot-input-area {
      padding: 10px;
      display: flex;
      gap: 8px;
      border-top: 1px solid rgba(255,255,255,.1);
      background: #0b1020;
    }

    #neurabot-input {
      flex: 1;
      border: 1px solid rgba(255,255,255,.12);
      background: #151b30;
      color: white;
      border-radius: 10px;
      outline: none;
      padding: 11px;
      font-size: 13px;
    }

    #neurabot-send {
      width: 42px;
      border: none;
      border-radius: 10px;
      background: #7c5cff;
      color: white;
      cursor: pointer;
      font-size: 17px;
    }

    .neurabot-typing {
      display: flex;
      gap: 4px;
      padding: 12px;
      background: #171e34;
      border-radius: 13px;
      width: fit-content;
    }

    .neurabot-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #aeb7d8;
      animation: neurabotTyping 1.2s infinite;
    }

    .neurabot-typing span:nth-child(2) {
      animation-delay: .15s;
    }

    .neurabot-typing span:nth-child(3) {
      animation-delay: .3s;
    }

    @keyframes neurabotTyping {
      0%,60%,100% {
        transform: translateY(0);
        opacity: .45;
      }

      30% {
        transform: translateY(-5px);
        opacity: 1;
      }
    }

    @media(max-width:480px) {
      #neurabot-window {
        right: 10px;
        left: 10px;
        bottom: 82px;
        width: auto;
        height: 70vh;
      }

      #neurabot-button {
        right: 15px;
        bottom: 15px;
      }
    }
  `;

  document.head.appendChild(style);

  /* ==============================
     BUTTON
  ============================== */

  const button =
    document.createElement("button");

  button.id =
    "neurabot-button";

  button.innerHTML = "✦";

  document.body.appendChild(button);

  /* ==============================
     WINDOW
  ============================== */

  const chat =
    document.createElement("div");

  chat.id =
    "neurabot-window";

  chat.innerHTML = `
    <div id="neurabot-header">
      <div id="neurabot-avatar">
        ✦
      </div>

      <div>
        <div id="neurabot-title">
          NeuraBot AI
        </div>

        <div id="neurabot-status">
          ● Online
        </div>
      </div>
    </div>

    <div id="neurabot-messages">
      <div class="neurabot-message neurabot-ai">
        Hi! 👋 How can I help you today?
      </div>
    </div>

    <div id="neurabot-input-area">
      <input
        id="neurabot-input"
        type="text"
        placeholder="Ask anything..."
      />

      <button id="neurabot-send">
        ➤
      </button>
    </div>
  `;

  document.body.appendChild(chat);

  const messages =
    chat.querySelector(
      "#neurabot-messages"
    );

  const input =
    chat.querySelector(
      "#neurabot-input"
    );

  const send =
    chat.querySelector(
      "#neurabot-send"
    );

  /* ==============================
     OPEN / CLOSE
  ============================== */

  button.addEventListener(
    "click",
    () => {
      const opened =
        chat.style.display === "flex";

      chat.style.display =
        opened ? "none" : "flex";

      if (!opened) {
        input.focus();
      }
    }
  );

  /* ==============================
     ADD MESSAGE
  ============================== */

  function addMessage(
    text,
    type
  ) {
    const message =
      document.createElement("div");

    message.className =
      `neurabot-message ${
        type === "user"
          ? "neurabot-user"
          : "neurabot-ai"
      }`;

    message.textContent =
      text;

    messages.appendChild(
      message
    );

    messages.scrollTop =
      messages.scrollHeight;
  }

  /* ==============================
     TYPING
  ============================== */

  function showTyping() {
    const typing =
      document.createElement("div");

    typing.id =
      "neurabot-typing";

    typing.className =
      "neurabot-typing";

    typing.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    messages.appendChild(
      typing
    );

    messages.scrollTop =
      messages.scrollHeight;
  }

  function hideTyping() {
    const typing =
      document.getElementById(
        "neurabot-typing"
      );

    if (typing) {
      typing.remove();
    }
  }

  /* ==============================
     SEND MESSAGE
  ============================== */

  async function sendMessage() {
    const text =
      input.value.trim();

    if (!text) return;

    addMessage(
      text,
      "user"
    );

    input.value = "";

    showTyping();

    try {
      const response =
        await fetch(
          `${apiUrl}/api/widget/chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              businessId,
              message: text,
            }),
          }
        );

      const data =
        await response.json();

      hideTyping();

      if (
        data.success &&
        data.answer
      ) {
        addMessage(
          data.answer,
          "ai"
        );
      } else {
        addMessage(
          data.message ||
            "Sorry, I couldn't process that.",
          "ai"
        );
      }
    } catch (error) {
      console.error(
        "NeuraBot error:",
        error
      );

      hideTyping();

      addMessage(
        "Sorry, the AI assistant is temporarily unavailable.",
        "ai"
      );
    }
  }

  send.addEventListener(
    "click",
    sendMessage
  );

  input.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter"
      ) {
        event.preventDefault();
        sendMessage();
      }
    }
  );
})();