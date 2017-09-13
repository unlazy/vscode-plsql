import { 
    DocumentSymbolProvider, TextDocument, CancellationToken,
    SymbolInformation, Location, Range, SymbolKind
} from 'vscode';

export class PLSQLDocumentSymbolProvider implements DocumentSymbolProvider {

    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): SymbolInformation[] {
        const regComment = `(?:\\/\\*[\\s\\S]*?\\*\\/)|(?:--.*)`;
        const declarationRegex = new RegExp(
            `(?:create(?:\\s+or\\s+replace)\\s+)((\\b(?:package|type)\\b(?:\\s+body)?)\\s+(?:\\w+\\.)?([\\w\\$]*))`,
            'i'
        );
        const methodsRegex = new RegExp(
            `(?:overriding)?(?:map)?(?:member)?(?:static)?(\\b(?:function|procedure)\\b)\\s+(?:\\w+\\.)?([\\w\\$]*)`,
            'gi'
        );
        const constantsRegex = new RegExp(
            '\\b([\\w\\d_\\$]+)\\b\\s+\\b(constant)\\b\\s+([\\w_\\d\\(\\)]+){1}\\s?(?::=)?\\s?(.+)?;',
            'gi'
        );

        const symbols: SymbolInformation[] = [],
              text = document.getText();

        let objectName: string;

        const declarationFound = declarationRegex.exec(text);
        if (declarationFound[1]) {
            objectName = declarationFound[3];
            symbols.push(this.createSymbolInformation(document, declarationFound.index, objectName, declarationFound[2], objectName));
        }

        let found: RegExpExecArray | null;
        while (found = methodsRegex.exec(text)) {
            if (found[1]) {
                symbols.push(this.createSymbolInformation(document, found.index, found[2], found[1], objectName));
            }
        }
        while (found = constantsRegex.exec(text)) {
            if (found[1]) {
                symbols.push(this.createSymbolInformation(document, found.index, found[1], found[2], objectName));
            }
        }
        return symbols;
    }

    private getSymbolKind(type: string): SymbolKind {
        if (type === 'function')
            return SymbolKind.Function;
        else if (type === 'procedure')
            return SymbolKind.Method;
        else if (type === 'package' || type === 'type')
            return SymbolKind.Package;
        else if (type === 'field')
            return SymbolKind.Field;
        else if (type === 'constant')
            return SymbolKind.Constant;
        else
            return SymbolKind.Object;
    }

    private createSymbolInformation(
        document: TextDocument, position: number, symbolName: string,
        symbolKind: string, objectName: string
    ): SymbolInformation {
        let line = document.lineAt(document.positionAt(position));
        const location = new Location(document.uri, new Range(line.range.start, line.range.end));
        return new SymbolInformation(symbolName, this.getSymbolKind(symbolKind.toLowerCase()), objectName, location);
    }
}