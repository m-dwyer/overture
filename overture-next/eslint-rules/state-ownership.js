const mutatingArrayMethods = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

const defaultOptions = {
  owners: [],
};

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require owned state shapes to be mutated only by their owning module.",
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
              required: ["type", "allow"],
              properties: {
                type: { type: "string" },
                allow: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    ],
    messages: {
      ownedStateMutation:
        "{{typeName}} is owned by {{allowedPaths}}. Mutate it through that module's public verbs instead.",
      missingTypeInfo:
        "The state ownership rule requires typed parser services.",
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
    const owners = options.owners.map((owner) => ({
      ...owner,
      allow: owner.allow.map(normalizePath),
    }));
    const filePath = normalizePath(context.filename ?? context.getFilename());

    function checkMutationTarget(node, reportNode) {
      const owner = findOwnedType(node);
      if (!owner || isAllowedPath(filePath, owner.allow)) return;
      context.report({
        node: reportNode,
        messageId: "ownedStateMutation",
        data: {
          typeName: owner.type,
          allowedPaths: owner.allow.join(", "),
        },
      });
    }

    function findOwnedType(node) {
      let current = unwrapChainExpression(node);
      while (current) {
        const owner = ownerForNode(current);
        if (owner) return owner;
        if (current.type !== "MemberExpression") return null;
        current = unwrapChainExpression(current.object);
      }
      return null;
    }

    function ownerForNode(node) {
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return null;
      const type = checker.getTypeAtLocation(tsNode);
      const names = typeNames(type);
      return owners.find((owner) => names.has(owner.type)) ?? null;
    }

    return {
      AssignmentExpression(node) {
        checkMutationTarget(node.left, node.left);
      },
      UpdateExpression(node) {
        checkMutationTarget(node.argument, node.argument);
      },
      UnaryExpression(node) {
        if (node.operator === "delete")
          checkMutationTarget(node.argument, node.argument);
      },
      CallExpression(node) {
        const callee = unwrapChainExpression(node.callee);
        if (callee?.type !== "MemberExpression") return;
        const propertyName = memberPropertyName(callee);
        if (!propertyName || !mutatingArrayMethods.has(propertyName)) return;
        checkMutationTarget(callee.object, callee);
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

function memberPropertyName(node) {
  if (node.computed) return null;
  if (node.property.type === "Identifier") return node.property.name;
  return null;
}

function unwrapChainExpression(node) {
  return node?.type === "ChainExpression" ? node.expression : node;
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function isAllowedPath(filePath, allowedPaths) {
  return allowedPaths.some((allowedPath) => {
    if (allowedPath.endsWith("/**"))
      return filePath.includes("/" + allowedPath.slice(0, -3) + "/");
    return (
      filePath.endsWith("/" + allowedPath) || filePath.endsWith(allowedPath)
    );
  });
}
