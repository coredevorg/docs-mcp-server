# MCP Tool Schema Validation Error Investigation

## Summary
All 10 MCP tools are reporting a schema validation error: `"code": "invalid_literal", "expected": "object"` for the `inputSchema.type` field.

## Root Cause Identified
The issue occurs in the MCP SDK's tool method parameter parsing logic. When tools are registered with an **empty object literal** `{}` for parameters (indicating no parameters), the SDK's `isZodRawShape()` function incorrectly identifies these as Zod parameter schemas and passes them to `getZodSchemaObject()`.

### The Problem Chain

1. **Tool Registration Code** (src/mcp/mcpServer.ts):
   - Tools like `list_libraries` are registered with an empty object: `{}`
   - Example at line 237-239:
     ```typescript
     server.tool(
       "list_libraries",
       "List all indexed libraries.",
       {
         // no params
       },
       ...
     )
     ```

2. **MCP SDK Detection** (node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js):
   - The `isZodRawShape()` function at line 652 has this logic:
     ```javascript
     function isZodRawShape(obj) {
         if (typeof obj !== 'object' || obj === null)
             return false;
         const isEmptyObject = Object.keys(obj).length === 0;
         // Check if object is empty or at least one property is a ZodType instance
         return isEmptyObject || Object.values(obj).some(isZodTypeLike);
     }
     ```
   - **BUG**: It returns `true` for empty objects (`isEmptyObject = true`)
   - This causes empty `{}` to be treated as a valid ZodRawShape

3. **Schema Conversion** (line 668-677):
   - `getZodSchemaObject()` converts the empty object:
     ```javascript
     function getZodSchemaObject(schema) {
         if (!schema) {
             return undefined;
         }
         if (isZodRawShape(schema)) {
             return z.object(schema);  // <-- Converts {} to z.object({})
         }
         return schema;
     }
     ```
   - `z.object({})` creates a Zod schema for an object with no properties

4. **Tool Registration** (line 446-454):
   - The inputSchema is stored as a Zod object schema
   - Later, when listing tools (line 59-66):
     ```javascript
     inputSchema: tool.inputSchema
         ? zodToJsonSchema(tool.inputSchema, {
             strictUnions: true,
             pipeStrategy: 'input'
         })
         : EMPTY_OBJECT_JSON_SCHEMA,
     ```

5. **Schema Generation Problem**:
   - `zodToJsonSchema(z.object({}))` converts to a JSON Schema
   - The conversion **does not include** `type: "object"` in some cases
   - This causes the validation error: `"type"` is missing or not "object"

## The 10 Affected Tools

1. **scrape_docs** - Has parameters, but issue may still affect it
2. **refresh_version** - Has parameters
3. **search_docs** - Has parameters
4. **list_libraries** - **NO parameters** (empty `{}`)
5. **find_version** - Has parameters
6. **list_jobs** - Has parameters
7. **get_job_info** - Has parameters
8. **cancel_job** - Has parameters
9. **remove_docs** - Has parameters
10. **fetch_url** - Has parameters

## Current Tool Definition Patterns

### Pattern 1: Tools with parameters (Zod objects)
```typescript
server.tool(
  "search_docs",
  "Search up-to-date documentation...",
  {
    library: z.string().trim().describe("Library name."),
    version: z.string().trim().optional().describe("Library version (optional)."),
    query: z.string().trim().describe("Documentation search query."),
    limit: z.number().optional().default(5).describe("Maximum number of results."),
  },
  { title: "Search Library Documentation", ... },
  async ({ library, version, query, limit }) => { ... }
);
```

### Pattern 2: Tools with NO parameters (empty object)
```typescript
server.tool(
  "list_libraries",
  "List all indexed libraries.",
  {
    // no params
  },
  { title: "List Libraries", ... },
  async () => { ... }
);
```

## How MCP SDK is Supposed to Work

The MCP SDK's `server.tool()` method has this parameter order:
1. `name` (string)
2. `description` (optional string)
3. `paramsSchema` (optional - either a Zod object or ZodRawShape)
4. `annotations` (optional - metadata object)
5. `callback` (function)

**Key: When there are NO parameters, the proper approach is:**
- Either omit the paramsSchema entirely
- Or explicitly use `z.object({})` (a proper Zod schema)

**NOT:**
- Pass an empty object literal `{}`
- The empty object is ambiguous - it could be both an empty ZodRawShape AND an empty annotations object

## The Zod to JSON Schema Issue

Even when `z.object({})` is converted properly, some versions of `zod-to-json-schema` may not include `type: "object"` in the output.

Expected output:
```json
{
  "type": "object",
  "properties": {}
}
```

But it might be generating:
```json
{
  "properties": {}
}
```

Or in some cases just:
```json
{}
```

## Solutions to Implement

### Solution 1: Use Proper Zod Schemas (Recommended)
Replace all empty `{}` with explicit Zod object schema:
```typescript
server.tool(
  "list_libraries",
  "List all indexed libraries.",
  z.object({}),  // Explicit Zod schema
  { title: "List Libraries", ... },
  async () => { ... }
);
```

### Solution 2: Omit Schema Parameter Entirely
Update calls to use the overload without a paramsSchema:
```typescript
server.tool(
  "list_libraries",
  "List all indexed libraries.",
  { title: "List Libraries", ... },  // This becomes annotations
  async () => { ... }
);
```

However, this won't work with the current MCP SDK version because the `tool()` overloads are complex and ambiguous.

### Solution 3: Use registerTool() Instead
Use the newer `registerTool()` method with explicit config:
```typescript
server.registerTool(
  "list_libraries",
  {
    title: "List Libraries",
    description: "List all indexed libraries.",
    inputSchema: z.object({}),  // Explicit empty schema
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
    }
  },
  async () => { ... }
);
```

### Solution 4: Fix in MCP SDK
The real fix should be in the MCP SDK to ensure `zodToJsonSchema()` always includes `type: "object"` for object schemas. But this is outside our control.

## Files to Modify

- `/Users/bst/Developer/MCP/docs-mcp-server/src/mcp/mcpServer.ts` - Main tool registration file
  - Lines with empty `{}` parameters need to be changed

## Verification Steps

1. Build the project with changes
2. Start the MCP server
3. Use MCP Inspector to validate tool schemas
4. Ensure all tools have `inputSchema.type: "object"` in their definitions
5. Verify no validation errors are reported

## References

- MCP SDK file: `/Users/bst/Developer/MCP/docs-mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js`
  - Line 649-658: `isZodRawShape()` function (has the ambiguity)
  - Line 668-677: `getZodSchemaObject()` function
  - Line 446-454: `_createRegisteredTool()` where schema is stored
  - Line 494-545: `tool()` method implementation
  - Line 535-541: `registerTool()` method

- Source file: `/Users/bst/Developer/MCP/docs-mcp-server/src/mcp/mcpServer.ts`
  - Tool registrations using `server.tool()`
