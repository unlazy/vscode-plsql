# PL/SQL (Oracle) language support for Visual Studio Code

This extension adds support for the PL/SQL (Oracle) language to Visual Studio Code.

## Colorization
Full syntax highlight for PL/SQL files based on oracle-textmate-bundle

## Autocomplete
Get competion items for procedures/functions/constants of packages

## Go to Symbol
Navigate to methods (procedures and functions) inside a package file

## Go to Definition
Navigate to methods (procedures and functions) with some limitations :
- Go to a method in the same file
- Go to a method in another file whose name includes the package or method name.
  <br />e.g.: *MY_PACKAGE.myFunction()*

## Documentation
Generate detailed documentation automatically for procedures and functions based on PlDoc.

Use Ctrl+Space (like others snippets) when the caret is on an empty line,
above a function or a procedure declaration, a 'special' snippet is generated.
(with prefix pldoc by default)

## Note
For this extension works with .sql files you must change your settings (user or workspace) like this:

        "files.associations": {
           	"*.pks": "plsql"
           	"*.pkb": "plsql"
           	"*.typ": "plsql"
           	"*.tyb": "plsql"
        }

