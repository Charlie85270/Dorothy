import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../utils/api.js";

interface VaultDocument {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  author: string;
  agent_id: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}

export function registerDocumentTools(server: McpServer): void {
  // vault_create_document
  server.tool(
    "vault_create_document",
    "Create a new document in the Vault. Use this to write reports, analyses, research findings, or any structured knowledge.",
    {
      title: z.string().describe("Document title"),
      content: z.string().describe("Document content (supports Markdown)"),
      folder_id: z.string().optional().describe("Folder ID to place the document in"),
      tags: z.array(z.string()).optional().describe("Tags for categorization (e.g. ['report', 'weekly', 'competitor'])"),
    },
    async ({ title, content, folder_id, tags }) => {
      try {
        const author = process.env.CLAUDE_AGENT_NAME || process.env.CLAUDE_AGENT_ID || "agent";
        const agent_id = process.env.CLAUDE_AGENT_ID || undefined;

        const result = await apiRequest("POST", "/api/vault/documents", {
          title,
          content,
          folder_id,
          author,
          agent_id,
          tags,
        }) as { success: boolean; document: VaultDocument };

        return {
          content: [{
            type: "text" as const,
            text: `Document created successfully!\nID: ${result.document.id}\nTitle: ${result.document.title}\nFolder: ${result.document.folder_id || "Root"}\nTags: ${tags?.join(", ") || "None"}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error creating document: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_update_document
  server.tool(
    "vault_update_document",
    "Update an existing document in the Vault.",
    {
      document_id: z.string().describe("The document ID to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content (replaces entire content)"),
      tags: z.array(z.string()).optional().describe("New tags (replaces existing tags)"),
      folder_id: z.string().optional().describe("Move to a different folder"),
    },
    async ({ document_id, title, content, tags, folder_id }) => {
      try {
        const body: Record<string, unknown> = {};
        if (title !== undefined) body.title = title;
        if (content !== undefined) body.content = content;
        if (tags !== undefined) body.tags = tags;
        if (folder_id !== undefined) body.folder_id = folder_id;

        const result = await apiRequest("PUT", `/api/vault/documents/${document_id}`, body) as { success: boolean; document: VaultDocument };

        return {
          content: [{
            type: "text" as const,
            text: `Document updated successfully!\nID: ${result.document.id}\nTitle: ${result.document.title}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error updating document: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_get_document
  server.tool(
    "vault_get_document",
    "Read a document from the Vault.",
    {
      document_id: z.string().describe("The document ID to read"),
    },
    async ({ document_id }) => {
      try {
        const result = await apiRequest("GET", `/api/vault/documents/${document_id}`) as {
          document: VaultDocument;
          attachments: Array<{ id: string; filename: string; mimetype: string; size: number }>;
        };

        const doc = result.document;
        const tags = JSON.parse(doc.tags || "[]");
        const attachmentList = result.attachments.length > 0
          ? `\nAttachments:\n${result.attachments.map(a => `  - ${a.filename} (${a.mimetype}, ${a.size} bytes)`).join("\n")}`
          : "";

        return {
          content: [{
            type: "text" as const,
            text: `Title: ${doc.title}\nID: ${doc.id}\nAuthor: ${doc.author}\nFolder: ${doc.folder_id || "Root"}\nTags: ${tags.join(", ") || "None"}\nCreated: ${doc.created_at}\nUpdated: ${doc.updated_at}${attachmentList}\n\n---\n\n${doc.content}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error reading document: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_list_documents
  server.tool(
    "vault_list_documents",
    "List documents in the Vault. Optionally filter by folder or tags.",
    {
      folder_id: z.string().optional().describe("Filter by folder ID"),
      tags: z.array(z.string()).optional().describe("Filter by tags (matches any)"),
    },
    async ({ folder_id, tags }) => {
      try {
        let path = "/api/vault/documents";
        const params: string[] = [];
        if (folder_id) params.push(`folder_id=${encodeURIComponent(folder_id)}`);
        if (tags && tags.length > 0) params.push(`tags=${encodeURIComponent(tags.join(","))}`);
        if (params.length > 0) path += `?${params.join("&")}`;

        const result = await apiRequest("GET", path) as { documents: VaultDocument[] };

        if (result.documents.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No documents found." }],
          };
        }

        const summary = result.documents.map(d => {
          const docTags = JSON.parse(d.tags || "[]");
          return `- [${d.id.slice(0, 8)}] ${d.title} (by ${d.author}, ${d.updated_at.slice(0, 10)}${docTags.length > 0 ? `, tags: ${docTags.join(", ")}` : ""})`;
        }).join("\n");

        return {
          content: [{
            type: "text" as const,
            text: `Found ${result.documents.length} document(s):\n${summary}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error listing documents: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_delete_document
  server.tool(
    "vault_delete_document",
    "Delete a document from the Vault.",
    {
      document_id: z.string().describe("The document ID to delete"),
    },
    async ({ document_id }) => {
      try {
        await apiRequest("DELETE", `/api/vault/documents/${document_id}`);
        return {
          content: [{
            type: "text" as const,
            text: `Document ${document_id} deleted successfully.`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error deleting document: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );

  // vault_attach_file
  server.tool(
    "vault_attach_file",
    "Attach a file to a Vault document.",
    {
      document_id: z.string().describe("The document ID to attach the file to"),
      file_path: z.string().describe("Absolute path to the file to attach"),
    },
    async ({ document_id, file_path }) => {
      try {
        const result = await apiRequest("POST", `/api/vault/documents/${document_id}/attach`, {
          file_path,
        }) as { success: boolean; attachment: { id: string; filename: string; mimetype: string; size: number } };

        return {
          content: [{
            type: "text" as const,
            text: `File attached successfully!\nAttachment ID: ${result.attachment.id}\nFilename: ${result.attachment.filename}\nType: ${result.attachment.mimetype}\nSize: ${result.attachment.size} bytes`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error attaching file: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );
}
