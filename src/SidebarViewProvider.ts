import * as vscode from "vscode";

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codeCompleterView";

  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    const savedApiKey = this._context.globalState.get("apiKey", "");
    const isRunning = this._context.globalState.get("isRunning", false);

    webviewView.webview.html = this.getHtmlForWebview(savedApiKey, isRunning);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "start":
          await this._context.globalState.update("isRunning", true);
          vscode.commands.executeCommand('code-completer.code-completer');
          vscode.window.showInformationMessage("CodexAI has started")
          this.updateWebview();
          break;
        case "stop":
          await this._context.globalState.update("isRunning", false);
          vscode.commands.executeCommand('code-completer.stop');
          vscode.window.showInformationMessage("CodexAI has stopped")
          this.updateWebview();
          break;
        case "setApiKey":
          if (message.apiKey.trim() === "") {
            vscode.window.showInformationMessage("❌ Please Enter a Valid API Key");
          } else {
            await this._context.globalState.update("apiKey", message.apiKey);
            vscode.commands.executeCommand("code-completer.fetch")
            vscode.window.showInformationMessage("✅ API Key has been set");
            this.updateWebview();
          }
          break;
        case "getState":
          this.updateWebview();
          break;
      }
    });
  }

  private updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateState",
        state: {
          apiKey: this._context.globalState.get("apiKey", ""),
          isRunning: this._context.globalState.get("isRunning", false)
        }
      });
    }
  }

  private getHtmlForWebview(savedApiKey: string, isRunning: boolean): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
       <style>
            body {
              padding: 20px;
              font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
              line-height: 1.6;
              color: #00f3ff;
              background-color: #0a0b17;
              max-width: 800px;
              margin: 0 auto;
              text-shadow: 0 0 5px rgba(0, 243, 255, 0.3);
              border: 1px solid #1a1f35;
              border-radius: 8px;
              box-shadow: 0 0 20px rgba(0, 111, 255, 0.1), inset 0 0 20px rgba(0, 243, 255, 0.05);
            }

            button {
              margin: 10px 0;
              padding: 10px 16px;
              width: 100%;
              border-radius: 4px;
              border: 1px solid #00f3ff;
              background-color: rgba(0, 30, 60, 0.7);
              color: #00f3ff;
              font-family: inherit;
              font-weight: 500;
              letter-spacing: 1px;
              cursor: pointer;
              transition: all 0.2s ease;
              position: relative;
              overflow: hidden;
              box-shadow: 0 0 8px rgba(0, 243, 255, 0.3);
            }
            button::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(
                90deg,
                transparent,
                rgba(0, 243, 255, 0.2),
                transparent
              );
              transition: 0.5s;
            }

            button:hover:not(:disabled)::before {
              left: 100%;
            }

            button:hover:not(:disabled) {
              background-color: rgba(0, 40, 80, 0.8);
              box-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
              transform: translateY(-2px);
            }

            button:active:not(:disabled) {
              transform: translateY(1px);
              box-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
            }

            button:disabled {
              background-color: rgba(30, 30, 40, 0.5);
              border-color: #2a3144;
              color: #425171;
              cursor: not-allowed;
              box-shadow: none;
              text-shadow: none;
            }

            input {
              height: calc(100% - 20px)
              margin: 10px 0;
              padding: 12px;
              width: calc(100% - 26px);
              border-radius: 4px;
              border: 1px solid #2a3144;
              background-color: rgba(16, 18, 34, 0.7);
              color: #00f3ff;
              font-family: inherit;
              font-size: 10px;
              transition: all 0.3s ease;
              box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.2);
            }
            input::placeholder{
              font-size : 8px
            }
            input:focus {
              border-color: #00f3ff;
              outline: none;
              box-shadow: 0 0 12px rgba(0, 243, 255, 0.3), inset 0 0 8px rgba(0, 0, 0, 0.2);
            }

            input:disabled {
              background-color: rgba(20, 22, 40, 0.5);
              color: #425171;
              cursor: not-allowed;
              border-color: #2a3144;
            }
              @keyframes scanline {
              0% {
                transform: translateY(-100%);
              }
              100% {
                transform: translateY(100%);
              }
            }

            body::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 2px;
              background: rgba(0, 243, 255, 0.1);
              animation: scanline 8s linear infinite;
              pointer-events: none;
            }
            .button-running {
                margin: 10px 0;
                padding: 10px 16px;
                width: 100%;
                border-radius: 4px;
                border: 1px solid #ffb347;
                background-color: rgba(60, 30, 0, 0.7);
                color: #ffb347;
                font-family: inherit;
                font-weight: 500;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
                box-shadow: 0 0 8px rgba(255, 179, 71, 0.3);
              }

              .button-running::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                  90deg,
                  transparent,
                  rgba(255, 179, 71, 0.2),
                  transparent
                );
                transition: 0.5s;
              }

              .button-running:hover:not(:disabled)::before {
                left: 100%;
              }

              .button-running:hover:not(:disabled) {
                background-color: rgba(80, 40, 0, 0.8);
                box-shadow: 0 0 15px rgba(255, 179, 71, 0.5);
                transform: translateY(-2px);
              }

              .button-running:active:not(:disabled) {
                transform: translateY(1px);
                box-shadow: 0 0 10px rgba(255, 179, 71, 0.4);
              }

              .button-running:disabled {
                background-color: rgba(40, 30, 20, 0.5);
                border-color: #4a3622;
                color: #715132;
                cursor: not-allowed;
                box-shadow: none;
                text-shadow: none;
              }
              .button-stop {
                margin: 10px 0;
                padding: 10px 16px;
                width: 100%;
                border-radius: 4px;
                border: 1px solid #ff3547;
                background-color: rgba(60, 0, 10, 0.7);
                color: #ff3547;
                font-family: inherit;
                font-weight: 500;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
                box-shadow: 0 0 8px rgba(255, 53, 71, 0.3);
              }

              .button-stop::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                  90deg,
                  transparent,
                  rgba(255, 53, 71, 0.2),
                  transparent
                );
                transition: 0.5s;
              }

              .button-stop:hover:not(:disabled)::before {
                left: 100%;
              }

              .button-stop:hover:not(:disabled) {
                background-color: rgba(80, 0, 10, 0.8);
                box-shadow: 0 0 15px rgba(255, 53, 71, 0.5);
                transform: translateY(-2px);
              }

              .button-stop:active:not(:disabled) {
                transform: translateY(1px);
                box-shadow: 0 0 10px rgba(255, 53, 71, 0.4);
              }

              .button-stop:disabled {
                background-color: rgba(40, 20, 20, 0.5);
                border-color: #4a2222;
                color: #713232;
                cursor: not-allowed;
                box-shadow: none;
                text-shadow: none;
              }
              .apibtn{
                font-size : 10px
              }
                hr {
                  border: none;
                  height: 2px;
                  background: linear-gradient(to right, transparent, #ff3547, transparent);
                  margin: 20px 0;
                  position: relative;
                  overflow: hidden;
                  box-shadow: 0 0 10px rgba(255, 53, 71, 0.5);
                }

                hr::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: -100%;
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(90deg, transparent, rgba(255, 53, 71, 0.6), transparent);
                  animation: glow 3s infinite linear;
                }

                @keyframes glow {
                  0% { left: -100%; }
                  100% { left: 100%; }
                }
        </style>
      </head>
      <body>
        <input type="text" id="apiKey" placeholder="Enter Gemini API Key" />
        <button class="apibtn">Save API Key</button>
        <hr>
        <button class="start">Start</button>
        <button class="stop">Stop</button>
        <script>
          const vscode = acquireVsCodeApi();
          let currentState = { apiKey: "", isRunning: false };

          function updateUI() {
            // Update API Key field
            const apiKeyInput = document.getElementById('apiKey');
            apiKeyInput.value = currentState.apiKey;
            apiKeyInput.disabled = !!currentState.apiKey;
            
            // Update API Button
            const apiBtn = document.querySelector('.apibtn');
            apiBtn.textContent = currentState.apiKey ? 'Update API Key' : 'Save API Key';

            
            // Update Start/Stop buttons
            const startBtn = document.querySelector('.start');
            const stopBtn = document.querySelector('.stop');
            
            startBtn.disabled = !currentState.apiKey;
            stopBtn.disabled = !currentState.apiKey;
            
            if (currentState.isRunning) {
              startBtn.classList.add('button-running');
              startBtn.textContent = 'Running';
              stopBtn.classList.add('button-stop');
            } else {
              startBtn.classList.remove('button-running');
              startBtn.textContent = 'Start';
              stopBtn.classList.remove('button-stop');
            }
          }

          // Message listener for state updates
          window.addEventListener('message', event => {
            if (event.data.command === 'updateState') {
              currentState = event.data.state;
              updateUI();
            }
          });

          // Initial state request
          vscode.postMessage({ command: 'getState' });

          // Button click handlers
          document.querySelector('.start').addEventListener('click', () => {
            vscode.postMessage({ command: 'start' });
          });

          document.querySelector('.stop').addEventListener('click', () => {
            vscode.postMessage({ command: 'stop' });
          });

          document.querySelector('.apibtn').addEventListener('click', () => {
            const apiKeyInput = document.getElementById('apiKey');
            if (apiKeyInput.disabled) {
              apiKeyInput.disabled = false;
              document.querySelector('.start').disabled = true;
              document.querySelector('.stop').disabled = true;
            } else {
              vscode.postMessage({ 
                command: "setApiKey", 
                apiKey: apiKeyInput.value 
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}