import { EditorStoreProvider } from "./_state/useEditorStore";
import { EditorHandler } from "./_handler/Editor.handler";
import { EditorHeaderArea } from "./_area/EditorHeader.area";
import { EditorWorkspaceArea } from "./_area/EditorWorkspace.area";
export default function EditorScreen() {
  return (
    <EditorStoreProvider>
      <EditorHandler>
        <EditorHeaderArea />
        <EditorWorkspaceArea />
      </EditorHandler>
    </EditorStoreProvider>
  );
}
