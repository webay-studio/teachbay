import { EditorSettingsAction } from "../_action/EditorSettings.action";
import { QuestionOrderAction } from "../_action/QuestionOrder.action";
import { ExamPreviewAction } from "../_action/ExamPreview.action";
export function EditorWorkspaceArea() {
  return (
    <>
      <EditorSettingsAction />
      <div className="editor-layout">
        <QuestionOrderAction />
        <ExamPreviewAction />
      </div>
    </>
  );
}
