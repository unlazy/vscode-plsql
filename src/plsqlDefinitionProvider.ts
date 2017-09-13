import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

interface PLSQLRange {
    start: number;
    end: number;
}

interface PLSQLInfos {
    packageName: string;
    specOffset?: number;
    bodyOffset?: number;
}

const enum PLSQLFindKind {
    PkgSpec = 1,
    PkgBody,
    Method
}

export class PLSQLDefinitionProvider implements vscode.DefinitionProvider {

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
        return new Promise<vscode.Location>((resolve, reject) => {
            let line = document.lineAt(position),
                lineText = line.text,
                range = document.getWordRangeAtPosition(position),
                currentWord = document.getText(range),
                documentText = document.getText(),
                infos: PLSQLInfos,
                offset: number;

            // find current procedure or function name
            if (currentWord === 'function' || currentWord === 'procedure') {
                const regexp = new RegExp(/(?:^\s+)?(\w+)/i);
                const found = regexp.exec(lineText.substr(range.end.character));
                if (found)
                    currentWord = found[1];
            }

            // Get infos of current package
            infos = this.getPackageInfos(documentText);

            // It's the specification or the body declaration line
            if (infos && (this.findPkgMethod(currentWord, lineText) !== null)) {
                if (infos.specOffset != null && infos.bodyOffset != null) {
                    let searchRange: PLSQLRange;
                    if (document.offsetAt(line.range.start) < infos.bodyOffset)
                        searchRange = {start: infos.bodyOffset, end: Number.MAX_VALUE};
                    else
                        searchRange = {start: 0, end: infos.bodyOffset};
                    if (offset = this.findPkgMethod(currentWord, documentText, searchRange))
                        resolve(this.getLocation(document, offset));
                    else
                        resolve(null);
                } else {
                    // search in another file (spec and body are in separate files)
                    this.findFile(infos.packageName, currentWord, infos.bodyOffset == null ? PLSQLFindKind.PkgBody : PLSQLFindKind.PkgSpec)
                    .then (value => {
                        resolve(value);
                    });
                }
            } else {
                // It's a link to another function
                let regExp = new RegExp(`\\b([\\w\\$]+)\\.${currentWord}`, 'i'),
                    found;
                if (found = regExp.exec(lineText)) {
                    let packageName = found[1].toLowerCase();
                    // In the same package
                    if (infos && (infos.packageName === packageName)) {
                        if (offset = this.findPkgMethod(currentWord, documentText, {start: infos.bodyOffset, end: Number.MAX_VALUE}))
                            resolve(this.getLocation(document, offset));
                        else
                            resolve(null);
                    } else {
                        // In another package
                        // Search in another file (after body) with filename
                        this.findFile(packageName, currentWord, PLSQLFindKind.PkgBody)
                        .then (value => {
                            if (value)
                                return value;
                            else
                                // Search in another file and it's not a package ! (perhaps a function or a method with shema)
                                return this.findFile(currentWord, currentWord, PLSQLFindKind.Method);
                        })
                        .then (value => {
                            return resolve(value);
                        });
                    }
                } else {
                    // function in the package or nested function
                    if (offset = this.findPkgMethod(currentWord, documentText, {start: infos ? infos.bodyOffset : 0, end: Number.MAX_VALUE}))
                        resolve(this.getLocation(document, offset));
                    else {
                        // TODO ? if it's not a keyword, string, number => resolve(null)
                        // Search in another file and it's not a package ! (perhaps a function or a method)
                        this.findFile(currentWord, currentWord, PLSQLFindKind.Method)
                        .then (value => {
                            resolve(value);
                        });
                    }
                }
            }
        });
    }

    private getPackageInfos(text: string): PLSQLInfos {
        let regexp = /\b(?:create(?:\s*or\s+replace)?\s*package)(?:\s*(body))?\s*(?:\w+\.)?([\w\$]*)/gi,
            infos: PLSQLInfos,
            found;

        while (found = regexp.exec(text)) {
            if (!infos)
                infos = {packageName: found[2].toLowerCase()};
            if (!found[1])  // body
                infos.specOffset = found.index;
            else
                infos.bodyOffset = found.index;
        }

        return infos;
    }

    private findPkgMethod(name, text: string, searchRange?: PLSQLRange): number {
        const regComment = `(?:\\/\\*[\\s\\S]*?\\*\\/)|(?:--.*)`;
        const regFind = `${regComment}|(\\b(?:function|procedure)\\s*${name}\\b)`;
        const regexp = new RegExp(regFind, 'gi');
        let   found;

        while (found = regexp.exec(text)) {
            if (found[1] &&
                (!searchRange || ((found.index > searchRange.start) && (found.index < searchRange.end)) ))
                return found.index;
        }

        return null;
    }

    private findMethod(name, text: string): number {
        const regComment = `(?:\\/\\*[\\s\\S]*?\\*\\/)|(?:--.*)`;
        const regFind = `${regComment}|(\\bcreate(?:\\s*or\\s+replace)?\\s*(?:function|procedure)\\s*(?:\\w+\\.)?${name}\\b)`;
        const regexp = new RegExp(regFind, 'gi');
        let   found;

        while (found = regexp.exec(text)) {
            if (found[1])
                return found.index;
        }

        return null;
    }

    private findFile(fileName, functionName: string, findKind: PLSQLFindKind): Thenable<vscode.Location> {
        return new Promise((resolve, reject) => {
            if (!vscode.workspace) {
                reject('No workspace');
                return;
            }
            const searchFileName = fileName.replace('$', '_');
            const rgOptions = ['--column', '-g', `${searchFileName}.*`, '--files', vscode.workspace.rootPath];
            let rg = childProcess.spawnSync('rg', rgOptions);
            if (rg.status || !rg.stdout) {
                if (rg.status)
                    reject(rg.stderr);
                else
                    resolve(null);
                return;
            }
            let files = rg.stdout.toString().split('\n');
            files.pop();
            this.readFiles(files, fileName, functionName, findKind)
                .then(value => { resolve(value); })
                .catch(error => { resolve(null); });
        });
    }

    private readFiles(allFiles, packageName, functionName, findKind: PLSQLFindKind): Promise<vscode.Location> {
        return new Promise((resolve, reject) => {
            console.log('result: ' + allFiles);
            allFiles.forEach((file) => {
                this.readFile(file, packageName, functionName, findKind)
                        .then(value => { if (value) { resolve(value); } })
                        .catch(error => { reject(error); });
            });
        });
    }

    private readFile(file, packageName, functionName, findKind: PLSQLFindKind): Promise<vscode.Location> {
        return new Promise<vscode.Location>((resolve, reject) => {
            let searchExt = ['.sql'];
            if (findKind === PLSQLFindKind.PkgSpec)
                searchExt.push('.pkh','.pks');
            else if (findKind === PLSQLFindKind.PkgBody)
                searchExt.push('.pkb');

            if (searchExt.indexOf(path.extname(file).toLowerCase()) < 0) {
                resolve(null);
            } else {
                let me = this;
                fs.readFile(file, (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let infos: PLSQLInfos,
                        offset: number,
                        text = data.toString();

                    if (findKind !== PLSQLFindKind.Method) {
                        // Get infos of current package
                        infos = this.getPackageInfos(text);

                        // if it's ok, find function
                        if (!infos)
                            // try with another file
                            resolve(null);
                        else if ((infos.bodyOffset != null) && (findKind === PLSQLFindKind.PkgBody) && (infos.packageName === packageName)) {
                            offset = me.findPkgMethod(functionName, text, {start: infos.bodyOffset, end: Number.MAX_VALUE});
                        } else if ((infos.specOffset != null) && (findKind === PLSQLFindKind.PkgSpec) && (infos.packageName === packageName)) {
                            offset = me.findPkgMethod(functionName, text, {start: infos.specOffset, end: infos.bodyOffset != null ? infos.bodyOffset : Number.MAX_VALUE});
                        } else {
                            // try with another file
                            resolve(null);
                        }
                    } else {
                        offset = me.findMethod(functionName, text);
                        if (offset == null)
                            // try with another file
                            resolve(null);
                    }

                    if (offset != null) {
                        vscode.workspace.openTextDocument(file)
                            .then(document => {
                                resolve(me.getLocation(document, offset));
                            });
                    } else {
                        // stop all search here
                        reject('function not found');
                    }
                });
            }
        });
    }

    private getLocation(document: vscode.TextDocument, offset: number): vscode.Location {
        return new vscode.Location(vscode.Uri.file(document.fileName), document.positionAt(offset));
    }
}