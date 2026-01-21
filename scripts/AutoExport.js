#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { default: traverse } = require("@babel/traverse");
const parser = require("@babel/parser");
const t = require("@babel/types");

/**
 * Recursively find all .js files in a directory
 * @param {string} dir - Directory path
 * @param {string[]} files - Array to store found files
 * @returns {string[]}
 */
function findJsFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            findJsFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Extract JSDoc comment from a node
 * @param {import('@babel/types').Node} node
 * @returns {string | null}
 */
function extractJSDoc(node) {
    if (node.leadingComments && node.leadingComments.length > 0) {
        const comment = node.leadingComments[node.leadingComments.length - 1];
        if (comment.type === "CommentBlock" && comment.value.startsWith("*")) {
            return comment.value;
        }
    }
    return null;
}

/**
 * Parse @type annotation from JSDoc
 * @param {string | null} jsdoc
 * @returns {string | null}
 */
function parseTypeFromJSDoc(jsdoc) {
    if (!jsdoc) {
        return null;
    }

    const typeIndex = jsdoc.indexOf("@type");
    if (typeIndex === -1) return null;

    const openBraceIndex = jsdoc.indexOf("{", typeIndex);
    if (openBraceIndex === -1) return null;

    // Use stack to find matching closing brace
    let stack = 0;
    let closeBraceIndex = -1;

    for (let i = openBraceIndex; i < jsdoc.length; i++) {
        const char = jsdoc[i];
        if (char === "{") {
            stack++;
        } else if (char === "}") {
            stack--;
            if (stack === 0) {
                closeBraceIndex = i;
                break;
            }
        }
    }

    if (closeBraceIndex === -1) return null;

    // Extract type between braces
    const typeContent = jsdoc.substring(openBraceIndex + 1, closeBraceIndex);

    // Remove JSDoc comment markers and extra whitespace
    return formatJSDocType(typeContent);
}

/**
 * Parse function type from JSDoc
 * @param {string | null} jsdoc
 * @returns {string | null}
 */
function parseFunctionTypeFromJSDoc(jsdoc) {
    if (!jsdoc) {
        return null;
    }

    // Extract @param tags
    const paramMatches = [...jsdoc.matchAll(/@param\s+\{([^}]+)\}\s+(\w+)/g)];

    // Extract @returns tag
    const returnMatch = jsdoc.match(/@returns\s+\{([^}]+)\}/);

    if (paramMatches.length === 0 && !returnMatch) {
        return null;
    }

    // Format parameters and return types
    const params = paramMatches.map((m) => {
        const paramName = m[2];
        const paramType = formatJSDocType(m[1]);
        return `${paramName}: ${paramType}`;
    }).join(", ");

    const returnType = returnMatch ? formatJSDocType(returnMatch[1]) : "void";

    return `(${params}) => ${returnType}`;
}

/**
 * Infer type from value expression
 * @param {import('@babel/types').Node} node
 * @returns {string}
 */
function inferTypeFromExpression(node) {
    if (t.isNumericLiteral(node)) return "number";
    if (t.isStringLiteral(node)) return "string";
    if (t.isBooleanLiteral(node)) return "boolean";

    // Handle arithmetic expressions (result is number)
    if (t.isBinaryExpression(node)) {
        return "number";
    }

    if (t.isArrayExpression(node)) return "any[]";
    if (t.isObjectExpression(node)) return "{ [key: string]: any }";
    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) return "any => any";
    if (t.isIdentifier(node)) return "any";

    return "any";
}

/**
 * Format multi-line JSDoc type to single line
 * @param {string} type
 * @returns {string}
 */
function formatJSDocType(type) {
    if (!type) return type;

    // Replace newlines and extra whitespace
    let formatted = type
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(" ");

    // Remove JSDoc comment markers (*)
    formatted = formatted.replace(/\s*\*\s*/g, " ");

    // Clean up extra spaces
    formatted = formatted.replace(/\s+/g, " ");

    return formatted;
}

/**
 * Extract JSDoc from statement before export call
 * @param {import('@babel/traverse').NodePath} path
 * @returns {string | null}
 */
function findJSDocForExport(path) {
    // Get the call expression's statement parent
    const statementPath = path.getStatementParent();
    if (!statementPath) return null;

    const { node } = statementPath;

    // Check if there's a standalone JSDoc comment before statement
    if (node.leadingComments && node.leadingComments.length > 0) {
        for (let i = node.leadingComments.length - 1; i >= 0; i--) {
            const comment = node.leadingComments[i];
            if (comment.type === "CommentBlock" && comment.value.includes("@type")) {
                return comment.value;
            }
        }
    }

    return null;
}

/**
 * Collect all exports from a file
 * @param {string} filePath
 * @returns {{ name: string, type: string, sourceFile: string }[]}
 */
function collectExportsFromFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const exports = [];

    try {
        const ast = parser.parse(content, {
            sourceType: "module",
            plugins: [],
        });

        // First pass: collect all variable declarations with their types
        const variableTypes = new Map();

        traverse(ast, {
            VariableDeclarator(path) {
                const { node } = path;
                if (t.isIdentifier(node.id)) {
                    const varName = node.id.name;

                    // Try to get JSDoc from VariableDeclaration parent
                    let jsdoc = extractJSDoc(path.parent);

                    // If no JSDoc on parent, try on declarator
                    if (!jsdoc) {
                        jsdoc = extractJSDoc(node);
                    }

                    let type = parseTypeFromJSDoc(jsdoc) ?? parseFunctionTypeFromJSDoc(jsdoc) ?? inferTypeFromExpression(node.init);

                    if (type !== "any") {
                        variableTypes.set(varName, type);
                    }
                }
            },

            FunctionDeclaration(path) {
                const { node } = path;
                if (t.isIdentifier(node.id)) {
                    const funcName = node.id.name;
                    const jsdoc = extractJSDoc(node);
                    const type = parseFunctionTypeFromJSDoc(jsdoc);

                    if (type && type !== "any") {
                        variableTypes.set(funcName, type);
                    }
                }
            },
        });

        // Second pass: find exports
        traverse(ast, {
            /**
             * Detect: global["name"] = value
             */
            AssignmentExpression(babelPath) {
                const { node } = babelPath;
                const left = node.left;

                if (
                    t.isMemberExpression(left) &&
                    t.isIdentifier(left.object, { name: "global" }) &&
                    t.isStringLiteral(left.property)
                ) {
                    const exportName = left.property.value;
                    const jsdoc = extractJSDoc(node);

                    let type = parseTypeFromJSDoc(jsdoc);

                    // Try to get type from value identifier
                    if (!type && t.isIdentifier(node.right)) {
                        type = variableTypes.get(node.right.name);
                    }

                    if (!type) {
                        type = inferTypeFromExpression(node.right);
                    }

                    // Format type to single line
                    type = formatJSDocType(type);

                    exports.push({
                        name: exportName,
                        type,
                        sourceFile: path.relative("src", filePath),
                    });
                }
            },

            /**
             * Detect: dataBus.export("name", value)
             */
            CallExpression(babelPath) {
                const { node } = babelPath;

                if (
                    t.isMemberExpression(node.callee) &&
                    t.isIdentifier(node.callee.object, { name: "dataBus" }) &&
                    t.isIdentifier(node.callee.property, { name: "export" }) &&
                    node.arguments.length >= 2 &&
                    t.isStringLiteral(node.arguments[0])
                ) {
                    const exportName = node.arguments[0].value;
                    const valueArg = node.arguments[1];

                    // Check for JSDoc on export statement
                    let type = parseTypeFromJSDoc(findJSDocForExport(babelPath));

                    // Try to get type from value identifier
                    if (!type && t.isIdentifier(valueArg)) {
                        type = variableTypes.get(valueArg.name);
                    }

                    if (!type) {
                        type = inferTypeFromExpression(valueArg);
                    }

                    // Format type to single line
                    type = formatJSDocType(type);

                    exports.push({
                        name: exportName,
                        type,
                        sourceFile: path.relative("src", filePath),
                    });
                }
            },
        });
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error.message);
    }

    return exports;
}

/**
 * Generate TypeScript declaration file
 * @param {{ name: string, type: string, sourceFile: string }[]} allExports
 * @param {string} outputPath
 */
function generateDTS(allExports, outputPath) {
    const uniqueExports = new Map();

    for (const exp of allExports) {
        if (!uniqueExports.has(exp.name)) {
            uniqueExports.set(exp.name, exp);
        }
    }

    const sortedExports = Array.from(uniqueExports.values()).sort((a, b) => a.name.localeCompare(b.name));

    let dtsContent = `/**
 * Auto-generated DataBus type declarations
 * Generated by scripts/AutoExport.js
 * Do not edit manually
 */

declare global {
    /**
     * All exported data types
     */
    interface ExportTypes {
`;

    for (const exp of sortedExports) {
        dtsContent += `        /**\n`;
        dtsContent += `         * Source: ${exp.sourceFile}\n`;
        dtsContent += `         * Type: ${exp.type}\n`;
        dtsContent += `         */\n`;
        dtsContent += `        "${exp.name}": ${exp.type};\n`;
    }

    dtsContent += `    }\n\n`;

    dtsContent += `    /**\n`;
    dtsContent += `     * DataBus interface with type-safe import\n`;
    dtsContent += `     */\n`;
    dtsContent += `    interface DataBus {\n`;
    dtsContent += `        /**\n`;
    dtsContent += `         * Export a value\n`;
    dtsContent += `         * @template T\n`;
    dtsContent += `         * @param {string} name - Export identifier\n`;
    dtsContent += `         * @param {T} value - Value to export\n`;
    dtsContent += `         */\n`;
    dtsContent += `        export<T>(name: string, value: T): void;\n\n`;

    dtsContent += `        /**\n`;
    dtsContent += `         * Import a previously exported value\n`;
    dtsContent += `         * @template T\n`;
    dtsContent += `         * @param {string} name - Export identifier\n`;
    dtsContent += `         * @returns {T} The exported value\n`;
    dtsContent += `         */\n`;
    dtsContent += `        import<T extends keyof ExportTypes>(name: T): ExportTypes[T];\n\n`;

    dtsContent += `        /**\n`;
    dtsContent += `         * Check if an export exists\n`;
    dtsContent += `         * @param {string} name - Export identifier\n`;
    dtsContent += `         */\n`;
    dtsContent += `        hasExport(name: string): boolean;\n\n`;

    dtsContent += `        /**\n`;
    dtsContent += `         * List all available export names\n`;
    dtsContent += `         * @returns {string[]}\n`;
    dtsContent += `         */\n`;
    dtsContent += `        listExports(): string[];\n`;
    dtsContent += `    }\n`;

    dtsContent += `}\n\n`;

    dtsContent += `export {};\n`;

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, dtsContent, "utf-8");
    console.log(`Generated ${outputPath} with ${sortedExports.length} exports`);

    // Print exports with types
    console.log("\nExports found:");
    for (const exp of sortedExports) {
        console.log(`  ${exp.name}: ${exp.type} (from ${exp.sourceFile})`);
    }
}

/**
 * Main function
 */
function main() {
    console.log("Scanning src/ directory for exports...");

    const srcDir = path.join(process.cwd(), "src");
    const jsFiles = findJsFiles(srcDir);

    console.log(`Found ${jsFiles.length} JavaScript files`);

    const allExports = [];

    for (const file of jsFiles) {
        const exports = collectExportsFromFile(file);
        allExports.push(...exports);
    }

    console.log(`Found ${allExports.length} total exports`);

    if (allExports.length === 0) {
        console.warn("No exports found. Make sure to use global['name'] = value or dataBus.export('name', value)");
        return;
    }

    const outputPath = path.join(process.cwd(), "types", "DataBus.d.ts");
    generateDTS(allExports, outputPath);

    console.log("\nDone!");
}

main();
