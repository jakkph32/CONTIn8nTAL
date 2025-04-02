import * as vscode from 'vscode';
import { n8nWorkflowSchema, N8nWorkflow } from './n8n-schema';
import { parseTree, findNodeAtLocation, ParseError, JSONDocument } from 'jsonc-parser';
import fetch from 'node-fetch';
import * as z from 'zod';


export class N8nWorkflowValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private workflowSchema: z.ZodObject<any> | null = null;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('n8n');
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        await this.loadWorkflowSchema(context);

        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(this.validateDocument, this),
            vscode.workspace.onDidOpenTextDocument(this.validateDocument, this),
            this.diagnosticCollection,
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                if (e.affectsConfiguration('n8n.workflowSchemaUrl')) {
                    await this.loadWorkflowSchema(context);
                }
            })
        );
    }

    public dispose(): void {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    }

    private async loadWorkflowSchema(context: vscode.ExtensionContext): Promise<void> {
        const schemaUrl = vscode.workspace.getConfiguration('n8n').get<string>('workflowSchemaUrl');

        if (!schemaUrl) {
            vscode.window.showWarningMessage('N8n workflow schema URL is not configured. Validation will be disabled.');
            this.workflowSchema = null;
            return;
        }

        try {
            const response = await fetch(schemaUrl);
            if (!response.ok) {
                vscode.window.showErrorMessage(`Failed to load workflow schema from ${schemaUrl}: ${response.statusText}`);
                this.workflowSchema = null;
                return;
            }

            const schemaData = await response.json();
            // TODO: Validate the schemaData itself to ensure it's a valid Zod schema.
            this.workflowSchema = z.object(schemaData);

            vscode.window.showInformationMessage('Successfully loaded workflow schema from n8n server.');

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load workflow schema: ${error.message}`);
            this.workflowSchema = null;
        }
    }

    private async validateDocument(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'json') {
            return; // Only validate JSON files for now.  We can extend this.
        }

        if (!this.workflowSchema) {
            return; // Validation is disabled
        }

        const text = document.getText();

        // Parse the JSON with location information
        const parseErrors: ParseError[] = [];
        const jsonDocument: JSONDocument = parseTree(text, parseErrors) as JSONDocument;

        if (parseErrors.length > 0) {
            // Handle JSON parsing errors
            const diagnostics: vscode.Diagnostic[] = parseErrors.map(error => {
                const range = new vscode.Range(
                    document.positionAt(error.offset),
                    document.positionAt(error.offset + error.length)
                );
                return new vscode.Diagnostic(
                    range,
                    `JSON Parsing Error: ${error.message}`,
                    vscode.DiagnosticSeverity.Error
                );
            });
            this.diagnosticCollection.set(document.uri, diagnostics);
            return; // Don't proceed with Zod validation if JSON is invalid
        }

        try {
            const workflowData = JSON.parse(text); // Still use JSON.parse for Zod
            const result = this.workflowSchema.safeParse(workflowData);

            const diagnostics: vscode.Diagnostic[] = [];

            if (!result.success) {
                // Validation failed!
                result.error.issues.forEach(issue => {
                    // Try to find the node in the JSON document corresponding to the Zod path
                    let node = jsonDocument;
                    try {
                        if (issue.path) {
                            node = findNodeAtLocation(jsonDocument, issue.path) as JSONDocument;
                        }
                    } catch (error) {
                        console.log("There was an issue finding the node on the json document: " + error)
                    }

                    let range: vscode.Range;

                    if (node && node.offset !== undefined && node.length !== undefined) {
                        // Use the location information from jsonc-parser
                        range = new vscode.Range(
                            document.positionAt(node.offset),
                            document.positionAt(node.offset + node.length)
                        );
                    } else {
                        // Fallback to the beginning of the document if location is not found
                        range = new vscode.Range(0, 0, 0, 0);
                    }

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Validation Error: ${issue.message} (path: ${issue.path.join('.')})`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostics.push(diagnostic);
                });
            }

            this.diagnosticCollection.set(document.uri, diagnostics);

        } catch (error: any) {
            const range = new vscode.Range(0, 0, 0, 0);
            const diagnostic = new vscode.Diagnostic(
                range,
                `Error parsing JSON: ${error.message}`,
                vscode.DiagnosticSeverity.Error
            );
            this.diagnosticCollection.set(document.uri, [diagnostic]);
        }
    }
}