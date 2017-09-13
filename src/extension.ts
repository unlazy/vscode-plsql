import * as vscode from 'vscode';
import { PLSQLReferenceProvider } from './plsqlReferenceProvider';
import { PLSQLDocumentSymbolProvider } from './plsqlDocumentSymbolProvider';
import { PLSQLDefinitionProvider } from './plsqlDefinitionProvider';
import { PLSQLCompletionItemProvider } from './plsqlCompletionItemProvider';
import { PLSQLWorkspaceSymbolProvider } from "./plsqlWorkspaceSymbolProvider";

export function activate(context: vscode.ExtensionContext) {
    const PLSQL = 'plsql';

    let providers = [
        vscode.languages.registerReferenceProvider(PLSQL, new PLSQLReferenceProvider),
        vscode.languages.registerDocumentSymbolProvider(PLSQL, new PLSQLDocumentSymbolProvider),
        vscode.languages.registerDefinitionProvider(PLSQL, new PLSQLDefinitionProvider),
        vscode.languages.registerCompletionItemProvider(PLSQL, new PLSQLCompletionItemProvider, '.'),
        vscode.languages.registerWorkspaceSymbolProvider(new PLSQLWorkspaceSymbolProvider)
    ];

    context.subscriptions.concat(providers);

    vscode.languages.setLanguageConfiguration(PLSQL, {
        indentationRules: {
            increaseIndentPattern: /^.*(\bbegin\b.*|\bexception\b.*|(\b(is|then|else|case|loop)\b))$/i,
            decreaseIndentPattern: /^\s*(end)\s+(if|loop|case)?(;)$/i
        },
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    });
}
