import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { PLDocController } from './pldocController';

export class PLSQLCompletionItemProvider implements vscode.CompletionItemProvider {

    private plDocController = new PLDocController();
    private plDocCustomItems: vscode.CompletionItem[];

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position,
        token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {

        return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
            const completionItems: vscode.CompletionItem[] = [];

            const lineText = document.lineAt(position.line).text,
                  text = document.getText(),
                  wordRange = document.getWordRangeAtPosition(position),
                  word = wordRange && document.getText(wordRange),
                  lineTillCurrentPosition = lineText.substr(0, position.character);

            const plDocItem = this.getPlDocItem(document, position, lineText, text);
            if (plDocItem)
                completionItems.push(plDocItem);

            if (!this.plDocCustomItems)
                this.plDocCustomItems = this.getPlDocCustomItems();
            Array.prototype.push.apply(completionItems, this.filterCompletion(this.plDocCustomItems, word));

            const regEx = /((?:[\w\$])*)\.((?:\w)*)$/i;
            let found;
            if (found = regEx.exec(lineTillCurrentPosition)) {
                Array.prototype.push.apply(completionItems, this.getPackageItems(found[1]));
            }

            if (completionItems.length > 0)
                resolve(completionItems);
            else
                resolve();
        });
    }

    private filterCompletion(items: vscode.CompletionItem[], word: string) {
        if (items && word)
            return items.filter(item => item.label.startsWith(word));
        else if (items)
            return items;
        else return [];
    }

    private createSnippetItem(snippet, origin = ''): vscode.CompletionItem {
        return this.createCompleteItem(vscode.CompletionItemKind.Snippet,
                snippet.prefix, snippet.description, snippet.body.join('\n'), origin);
    }

    private createCompleteItem(type: vscode.CompletionItemKind, label: string, doc = '', text = label, origin = ''): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, type);
        if (type === vscode.CompletionItemKind.Snippet) {
            item.insertText = new vscode.SnippetString(text);
        } else
            item.insertText = text;
        item.documentation = doc;
        item.detail = origin;
        return item;
    }

    private getPlDocItem(document: vscode.TextDocument, position: vscode.Position, lineText: string, text: string): vscode.CompletionItem {
        // Empty line, above a function or procedure
        if ((text !== '') && (lineText.trim() === '') && (document.lineCount > position.line + 1)) {

            const nextPos = new vscode.Position(position.line + 1, 0),
                  nextText = text.substr(document.offsetAt(nextPos));

            const snippet = this.plDocController.getDocSnippet(nextText);
            if (snippet)
                return this.createSnippetItem(snippet, 'pldoc');
        };
    }

    private getPlDocCustomItems(): vscode.CompletionItem[] {
        const snippets = this.plDocController.getCustomSnippets();
        if (snippets)
            return snippets.map(snippet => this.createSnippetItem(snippet));
        return [];
    }

    private getPackageItems(pkg: String): vscode.CompletionItem[] {
        const fileName = pkg.replace('$', '_').toLowerCase();
        const searchRegex = '^.*?(?i)(((function|procedure)\\s+([[:alnum:]]+))|(([\\w\\d_]+)\\s+(constant))).*?$';
        let rgOptions = [searchRegex, '-g', `${fileName}.{pks,typ}`, '-r', "$6,$4", vscode.workspace.rootPath, '-E', 'cp1251'];
        let rg = childProcess.spawnSync('rg', rgOptions);

        if (rg.status || !rg.stdout) {
            console.log(rg.stderr.toString().substr(1,1000))
            return [];
        }

        let result = rg.stdout.toString().split('\n');
        result.pop();

        let list = [];
        result.forEach(line => {
            let arr = line.replace(vscode.workspace.rootPath, '').split(':');
            if (arr.length > 1) {
                let items = arr[1].split(',');
                if (items[0]) {
                    list.push(this.createCompleteItem(vscode.CompletionItemKind.Constant, items[0]));
                } else {
                    list.push(this.createCompleteItem(vscode.CompletionItemKind.Function, items[1]));
                }
            }
        })

        return list;
    }
}