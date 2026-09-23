import { FileDropAction } from "../_action/FileDrop.action";
import { FilePickerAction } from "../_action/FilePicker.action";
import { ImportProgressAction } from "../_action/ImportProgress.action";
import { DocumentReviewAction } from "../_action/DocumentReview.action";
import { PendingQuestionsAction } from "../_action/PendingQuestions.action";
import { QuestionCropAction } from "../_action/QuestionCrop.action";
import { AnalysisWorkspaceAction } from "../_action/AnalysisWorkspace.action";
export function RegistrationWorkspaceArea() {
  return (
    <section className="registration-workspace min-w-0">
      <FileDropAction>
        <FilePickerAction />
        <ImportProgressAction />
        <AnalysisWorkspaceAction />
        <DocumentReviewAction />
        <PendingQuestionsAction />
        <QuestionCropAction />
      </FileDropAction>
    </section>
  );
}
