// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { SidebarViewProvider } from './SidebarViewProvider';

let typingTimeout: NodeJS.Timeout | null = null;
let aiSuggestion: string = "";
let isPending : boolean = false
let isApiCallInProgress: boolean = false;
let abort : AbortController|null  = null;
let isExtensionRunning : boolean = false
let apiKey : string  = "" 

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	apiKey = context.globalState.get("apiKey","")
	console.log('Congratulations, your extension "CodexAI" is now active!');
	const provider = new SidebarViewProvider(context);
	// Register the sidebar provider FIRST
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, provider)
	);
	const disposable = vscode.commands.registerCommand('code-completer.code-completer', () => {
		isExtensionRunning = true 
		vscode.workspace.onDidChangeTextDocument((event) => {
			if(!isExtensionRunning){
				return 
			}
			if (typingTimeout) {
				clearTimeout(typingTimeout); 
			}
			
			if(isPending){
				aiSuggestion = ""
				isPending= false
			}

			if(!isApiCallInProgress&&!isPending){
			typingTimeout = setTimeout(async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const position = editor.selection.active;
                    const document = editor.document;
                    const codeBeforeCursor = getcodeBeforeCursor(document, position)
					const codeAfterCursor = getCodeAfterCursor(document,position)
					
                    try {
                        // Store the suggestion in the global variable
						if(!aiSuggestion.trim()){
						isApiCallInProgress = true
                        aiSuggestion = await callLLM(codeBeforeCursor , codeAfterCursor , apiKey);
						console.log(aiSuggestion)
						}
						if(aiSuggestion.trim()){
							isPending = true
							vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
						}
                    } catch (error) {
                        console.error('Error calling LLM:', error);
                        vscode.window.showErrorMessage('Failed to get code suggestion');
                        aiSuggestion = "";
                    } finally{
						isApiCallInProgress = false
					}
                }
            }, 1000); 
		}
		});
	});
	context.subscriptions.push(disposable);
	vscode.languages.registerInlineCompletionItemProvider("*", {
		async provideInlineCompletionItems(document, position, context, token) {
			if (!aiSuggestion.trim()) return { items: [] };
			const range  = new vscode.Range(position,position)
			const completion = new vscode.InlineCompletionItem(aiSuggestion, range);
			completion.command={
				title:"suggestion accepted",
				command:"extention.accepted"
			}
		  return{items:[completion]};
		}
	  });
	  vscode.commands.registerCommand("extension.requestNewSuggestion", async () => {
		aiSuggestion = "";  
		isPending = false;  
	
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			const edit = new vscode.WorkspaceEdit();
			const position = new vscode.Position(0, 0); 
	
			edit.insert(document.uri, position, "\u200B");
			await vscode.workspace.applyEdit(edit);
	
			// Undo the edit to remove any invisible changes
			await vscode.commands.executeCommand("undo");
		}
	});
	
	  vscode.commands.registerCommand("extention.accepted",()=>{
		isPending = false
		aiSuggestion=""
	  })


	  const stopCommand = vscode.commands.registerCommand('code-completer.stop', () => {
		isExtensionRunning = false;
		if (typingTimeout) {
			clearTimeout(typingTimeout);
		}
		if (abort) {
			abort.abort();
			abort = null;
		}
		aiSuggestion = "";
		isPending = false;
		isApiCallInProgress = false;
	});
	
	context.subscriptions.push(stopCommand);

	const fetchKey = vscode.commands.registerCommand('code-completer.fetch', () => {
		apiKey = context.globalState.get("apiKey","")
	});
	
	context.subscriptions.push(fetchKey);
}

let call = 0
async function callLLM(codeBeforeCursor:string,codeAfterCursor:string , apiKey:string){
	const genAI = new GoogleGenerativeAI(`${apiKey}`);
	const model = genAI.getGenerativeModel({ 
	model: "gemini-2.5-flash-preview-04-17",
	systemInstruction:`You are an **AI-powered coding assistant** embedded in VS Code, functioning like GitHub Copilot. Your role is to provide **real-time, context-aware inline code suggestions** by analyzing both the preceding and following code context.

		### **Behavior:**  
		- Predict and complete the next few lines of code based on **both the code before and after the cursor**.  
		- Maintain the **programming language, syntax, and style** used in the document.  
		- !!!IMPORTANT!!!!Keep responses **short, relevant, and syntactically correct**—avoid unnecessary modifications.  
		- **Do not include explanations, comments, or Markdown fences**—only return the raw code snippet.  
		- Ensure suggestions seamlessly fit into the user's workflow, avoiding redundant or incorrect completions.  

		Guidelines:  
		- Suggest contextually relevant code based on the cursor position.  
		- If a previous suggestion was rejected, provide an alternative approach.  
		- Consider the entire file for a better understanding, including imports and function definitions.  
		- Avoid repeating previous suggestions unless explicitly requested.  
		- Optimize for efficiency and best coding practices.  

		### Understanding Context:
		- Lines starting with "// " contain **important contextual information** about the code.  
		- Use the **context provided in these comments** to better predict the next lines of code.  
		- Do **not** include "// " comments in the response.  
		- Focus only on the necessary code completion based on both the **provided code and the given context**.  
				
		### **Context Usage:**  
		- **Code before the cursor**: Provides context for understanding ongoing logic and structures.  
		- **Code after the cursor**: Helps ensure smooth transitions without breaking syntax or logical flow.  

		Always generate **concise, high-quality suggestions** that naturally integrate into the user's code.
		!!!IMPORTANT -> only return the code dont return anything else , dont return comments [//] , dont return xml [<> </>] , just return pure code 
		
		!!!EXAMPLES->
		[
    {
				beforeCursor: "
		function fetchData(url) {
			return new Promise((resolve, reject) => {
				fetch(url)
				",
				afterCursor: "
				});
		}
				",
				expectedCompletion: "
					.then(response => response.json())
					.then(data => resolve(data))
					.catch(error => reject(error));
				"
			},
			{
				beforeCursor: "
		const numbers = [1, 2, 3, 4, 5];
		const squaredNumbers =
				",
				afterCursor: ";
		console.log(squaredNumbers);
				",
				expectedCompletion: "
		numbers.map(num => num * num)
				"
			},
			{
				beforeCursor: "
		document.getElementById("submitBtn").addEventListener("click", () => {
				",
				afterCursor: "
		});
				",
				expectedCompletion: "
			console.log("Button clicked");
				"
			},
			{
				beforeCursor: "
		const user = {
			id: 1,
			name: "Alice",
				",
				afterCursor: "
		};
				",
				expectedCompletion: "
			email: "alice@example.com",
			age: 25
				"
			},
			{
				beforeCursor: "
		for (let i = 0; i < 10; i++) {
				",
				afterCursor: "
		}
				",
				expectedCompletion: "
			console.log(i);
				"
			}
];` 
	});

	if(abort){
		abort.abort()
	}
	abort = new AbortController()
	const {signal} = abort
	try{
	console.log(`call:${call++}`)
	const result = await model.generateContent({
		contents: [
			{
			  role: 'user',
			  parts: [
				{
				  text: `code before the cursor =>${codeBeforeCursor}
				  		code after the cursor =>${codeAfterCursor}`,
				}
			  ],
			}
		],
		generationConfig: {
			responseSchema: {
				type: SchemaType.OBJECT,
				properties: {
					code: {
					type: SchemaType.STRING,
					description: "The code snippet only"
					}
				},
				required: ["code"]
				},
			maxOutputTokens: 1000,
			temperature: 0.1,
		}	
	},
	{signal}
	);
	return result.response.text()
	}catch(err:any){
		if (err.name === "AbortError") {
			console.log("Previous request canceled");
		} else {
			console.error("Error:", err);
			vscode.window.showErrorMessage("failed to get code suggestions")
		}
		return "";
	}finally{
		abort = null
	}
	}


function getcodeBeforeCursor(document:vscode.TextDocument,position:vscode.Position){
	const range  = new vscode.Range(new vscode.Position(0,0),position)  
	const code = document.getText(range)
	return code
}


function getCodeAfterCursor(document:vscode.TextDocument,position:vscode.Position){
	const lastLine = document.lineCount - 1; // Last line index
	const lastCharacter = document.lineAt(lastLine).text.length; // Last character in last line
	const endPosition = new vscode.Position(lastLine, lastCharacter); // End position

	const range = new vscode.Range(position, endPosition);
	const code = document.getText(range)
	return code
}
  
// This method is called when your extension is deactivated
export function deactivate() {}
