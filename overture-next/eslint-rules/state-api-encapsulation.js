const defaultOptions = {
  owners: [],
};

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent public APIs from accepting owned state objects as mutation targets.",
    },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          owners: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["type"],
              properties: {
                type: { type: "string" },
              },
            },
          },
        },
      },
    ],
    messages: {
      exportedOwnedStateParameter:
        "{{typeName}} is an owned state object. Expose domain methods, snapshots, or narrow read contracts instead of exported functions that accept it as a parameter.",
      missingTypeInfo: "The state API encapsulation rule requires typed parser services.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) {
      return {
        Program(node) {
          context.report({ node, messageId: "missingTypeInfo" });
        },
      };
    }

    const checker = services.program.getTypeChecker();
    const options = context.options[0] ?? defaultOptions;
    const owners = options.owners.map((owner) => owner.type);

    function checkExportedFunction(node) {
      for (const parameter of node.params) {
        const owner = ownerForNode(parameter);
        if (!owner) continue;
        context.report({
          node: parameter,
          messageId: "exportedOwnedStateParameter",
          data: { typeName: owner },
        });
      }
    }

    function checkExportedVariableDeclaration(node) {
      for (const declaration of node.declarations) {
        const init = declaration.init;
        if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
          checkExportedFunction(init);
        }
      }
    }

    function ownerForNode(node) {
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return null;
      const type = checker.getTypeAtLocation(tsNode);
      const names = typeNames(type);
      return owners.find((owner) => names.has(owner)) ?? null;
    }

    return {
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === "FunctionDeclaration") checkExportedFunction(node.declaration);
        if (node.declaration?.type === "VariableDeclaration") checkExportedVariableDeclaration(node.declaration);
      },
    };
  },
};

function typeNames(type) {
  const names = new Set();
  collectTypeNames(type, names);
  return names;
}

function collectTypeNames(type, names) {
  if (type.aliasSymbol) names.add(type.aliasSymbol.getName());
  const symbol = type.getSymbol();
  if (symbol) names.add(symbol.getName());
  if (type.isUnionOrIntersection()) {
    for (const part of type.types) collectTypeNames(part, names);
  }
}
