import * as vscode from 'vscode';
import { TextDocument } from 'vscode';
import * as cp from 'child_process';
import { PLSQLDocumentSymbolProvider } from "./plsqlDocumentSymbolProvider";

export class PLSQLWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    private symbols: Thenable<vscode.SymbolInformation[]>;

    public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        if (this.symbols != null) {
            return this.symbols;
        } else {
            let result = Promise.resolve(processWorkspace(query, token));
            this.symbols = result;
            return result;
        }
    }
}

const documentSymbolProvider = new PLSQLDocumentSymbolProvider();

function openTextDocuments(uris: vscode.Uri[]): Thenable<TextDocument[]> {
    return Promise.all(
        uris.map(uri => vscode.workspace.openTextDocument(uri).then(doc => doc)),
    );
}

function processTextDocuments(documents: TextDocument[], token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[][]> {
    return Promise.all(documents.map(document => documentSymbolProvider.provideDocumentSymbols(document, token)));
}

function processWorkspace(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
    let docs = vscode.workspace.findFiles('**/*.{pks,typ,pkb,tyb,prc}')
        .then(workspaceFiles => {
            let openedTextDocuments = openTextDocuments(workspaceFiles);
            let processedTextDocuments = openedTextDocuments.then(
                results => {
                    return processTextDocuments(results, token);
                },
                err => {
                    return [];
                },
            );
            let symbolInformation = processedTextDocuments.then(
                symbols => {
                    return [].concat.apply([], symbols) as vscode.SymbolInformation[];
                },
                err => {
                    return [] as vscode.SymbolInformation[];
                },
            );
            return symbolInformation;
        },
        fileError => {
            return [];
        },
    );
    return <any>docs;
}