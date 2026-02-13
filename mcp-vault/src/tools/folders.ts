import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../utils/api.js";

interface VaultFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export function registerFolderTools(server: McpServer): void {
  // vault_create_folder
  server.tool(
    "vault_create_folder",
    "Create a folder in the Vault for organizing documents.",
    {
      name: z.string().describe("Folder name"),
      parent_id: z.string().optional().describe("Parent folder ID for nesting"),
    },
    async ({ name, parent_id }) => {
      try {
        const result = await apiRequest("POST", "/api/vault/folders", {
          name,
          parent_id,
        }) as { success: boolean; folder: VaultFolder };

        return {
          content: [{
            type: "text" as const,
            text: `Folder created successfully!\nID: ${result.folder.id}\nName: ${result.folder.name}\nParent: ${result.folder.parent_id || "Root"}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error creating folder: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_list_folders
  server.tool(
    "vault_list_folders",
    "List all folders in the Vault.",
    {},
    async () => {
      try {
        const result = await apiRequest("GET", "/api/vault/folders") as { folders: VaultFolder[] };

        if (result.folders.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No folders found." }],
          };
        }

        // Build tree structure
        const rootFolders = result.folders.filter(f => !f.parent_id);
        const childMap = new Map<string, VaultFolder[]>();
        for (const folder of result.folders) {
          if (folder.parent_id) {
            const children = childMap.get(folder.parent_id) || [];
            children.push(folder);
            childMap.set(folder.parent_id, children);
          }
        }

        function renderTree(folders: VaultFolder[], indent = ""): string {
          return folders.map(f => {
            const children = childMap.get(f.id) || [];
            let line = `${indent}- ${f.name} [${f.id.slice(0, 8)}]`;
            if (children.length > 0) {
              line += "\n" + renderTree(children, indent + "  ");
            }
            return line;
          }).join("\n");
        }

        return {
          content: [{
            type: "text" as const,
            text: `Vault folders:\n${renderTree(rootFolders)}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error listing folders: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_delete_folder
  server.tool(
    "vault_delete_folder",
    "Delete a folder from the Vault. Documents in the folder will be moved to root.",
    {
      folder_id: z.string().describe("The folder ID to delete"),
      recursive: z.boolean().optional().describe("If true, also delete all documents and subfolders"),
    },
    async ({ folder_id, recursive }) => {
      try {
        let path = `/api/vault/folders/${folder_id}`;
        if (recursive) {
          path += "?recursive=true";
        }
        await apiRequest("DELETE", path);

        return {
          content: [{
            type: "text" as const,
            text: `Folder ${folder_id} deleted successfully.${recursive ? " All contents were also deleted." : " Documents were moved to root."}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error deleting folder: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );
}
