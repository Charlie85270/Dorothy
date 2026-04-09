import { create } from 'zustand';

export interface OpenedFileEntry {
  filePath: string;
  filename: string;
  content: string;
}

interface OpenedFilesState {
  /** Map of agentId → opened file */
  files: Map<string, OpenedFileEntry>;
  setFile: (agentId: string, file: OpenedFileEntry) => void;
  removeFile: (agentId: string) => void;
  getFile: (agentId: string) => OpenedFileEntry | undefined;
}

export const useOpenedFilesStore = create<OpenedFilesState>((set, get) => ({
  files: new Map(),

  setFile: (agentId, file) =>
    set((state) => {
      const next = new Map(state.files);
      next.set(agentId, file);
      return { files: next };
    }),

  removeFile: (agentId) =>
    set((state) => {
      const next = new Map(state.files);
      next.delete(agentId);
      return { files: next };
    }),

  getFile: (agentId) => get().files.get(agentId),
}));
