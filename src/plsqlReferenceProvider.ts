import * as vscode from 'vscode';
import * as childProcess from 'child_process';

export class PLSQLReferenceProvider implements vscode.ReferenceProvider {
    public provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location[]> {
        const searchTerm = document.getText(document.getWordRangeAtPosition(position)).replace('$', '\\\$');
        let rgOptions = this.getFindOptions().split(' ').concat([searchTerm, vscode.workspace.rootPath]);
        let rg = childProcess.spawnSync('rg', rgOptions);
        let lines = rg.stdout.toString().split('\n');
        let list = [];
        lines.forEach((item) => {
            let arr = item.replace(vscode.workspace.rootPath, '').split(':');
            if (arr.length > 2) {
                let lineNumber = parseInt(arr[1]) - 1;
                let columnNumber = parseInt(arr[2]) - 1;
                let startPos = new vscode.Position(lineNumber, columnNumber);
                let endPos = new vscode.Position(lineNumber, columnNumber + searchTerm.length);
                let location = new vscode.Location(vscode.Uri.file(vscode.workspace.rootPath + arr[0]), new vscode.Range(startPos, endPos));
                list.push(location);
            }
        });
        return list;
    }

    private getFindOptions(): String {
        const find_options = vscode.workspace.getConfiguration().get('plsql-language.find-references.options');
        const options = '--column ' + find_options;
        return options.trim();
    }
}