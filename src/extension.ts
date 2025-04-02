import * as vscode from 'vscode';
import { N8nWorkflowValidator } from './n8n-validation';
import fetch from 'node-fetch';

export function activate(context: vscode.ExtensionContext) {
  const validator = new N8nWorkflowValidator();
  validator.activate(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('n8n.uploadWorkflow', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active text editor found.');
        return;
      }

      const workflowContent = editor.document.getText();
      const serverUrl = vscode.workspace.getConfiguration('n8n').get<string>('serverUrl');
      const apiKey = vscode.workspace.getConfiguration('n8n').get<string>('apiKey');

      if (!serverUrl) {
        vscode.window.showErrorMessage('N8n server URL is not configured.');
        return;
      }

      try {
        // Implement workflow upload logic using the n8n API
        const response = await fetch(`${serverUrl}/rest/workflows`, { // Replace /rest/workflows with the correct n8n API endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': apiKey || '', // Include API key if provided (check n8n documentation for the correct header)
          },
          body: workflowContent,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
        }

        const responseData = await response.json();
        vscode.window.showInformationMessage(`Uploaded workflow to ${serverUrl}. Workflow ID: ${responseData.id}`); // Adjust based on the actual response

      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to upload workflow: ${error.message}`);
      }
    })
  );

  console.log('n8n extension is now active!');
}

export function deactivate() { }