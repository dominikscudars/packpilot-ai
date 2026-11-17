import { createContext, useContext, useState, type ReactNode } from "react";
import { loadWorkspace, saveWorkspace } from "../storage/workspace";
import type { Workspace } from "../models/types";
const storage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};
const Context = createContext<{
  workspace: Workspace;
  update: (workspace: Workspace) => void;
  notice: string | null;
} | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => loadWorkspace(storage));
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [notice, setNotice] = useState(initial.notice);
  function update(next: Workspace) {
    setWorkspace(next);
    setNotice(saveWorkspace(storage, next));
  }
  return (
    <Context.Provider value={{ workspace, update, notice }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider missing");
  return context;
}
