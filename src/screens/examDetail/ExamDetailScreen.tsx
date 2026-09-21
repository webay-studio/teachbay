import { Shell } from "@ui/shared";
import { ExamDetailStoreProvider } from "./_state/useExamDetailStore";
import { ExamDetailHandler } from "./_handler/ExamDetail.handler";
import { SavedWorksheetArea } from "./_area/SavedWorksheet.area";
export default function ExamDetailScreen({ id }: { id: string }) {
  return (
    <Shell>
      <ExamDetailStoreProvider key={id}>
        <ExamDetailHandler id={id}>
          <SavedWorksheetArea />
        </ExamDetailHandler>
      </ExamDetailStoreProvider>
    </Shell>
  );
}
