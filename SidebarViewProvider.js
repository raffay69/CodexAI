import * as vscode from "vscode";
export class SidebarViewProvider {
    _view;
    _context;
    constructor(context) {
        this._context = context;
    }
    resolveWebviewView(view) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.getHtmlForWebview();
        view.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case "start":
                    vscode.window.showInformationMessage("Code Completer Started");
                    break;
                case "stop":
                    vscode.window.showInformationMessage("Code Completer Stopped");
                    break;
                case "setApiKey":
                    this._context.globalState.update("apiKey", message.apiKey);
                    vscode.window.showInformationMessage("API Key Saved");
                    break;
            }
        });
    }
    getHtmlForWebview() {
        return `
      <html>
      <body>
        <button onclick="sendMessage('start')">Start</button>
        <button onclick="sendMessage('stop')">Stop</button>
        <input type="text" id="apiKey" placeholder="Enter API Key" />
        <button onclick="saveApiKey()">Save API Key</button>

        <script>
          const vscode = acquireVsCodeApi();

          function sendMessage(command) {
            vscode.postMessage({ command });
          }

          function saveApiKey() {
            const apiKey = document.getElementById("apiKey").value;
            vscode.postMessage({ command: "setApiKey", apiKey });
          }
        </script>
      </body>
      </html>
    `;
    }
}
//# sourceMappingURL=SidebarViewProvider.js.map