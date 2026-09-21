import { Shell } from "@ui/shared";
import { ExamsStoreProvider } from "./_state/useExamsStore";
import { ExamsHandler } from "./_handler/Exams.handler";
import { ExamHeaderArea } from "./_area/ExamHeader.area";
import { ExamCollectionArea } from "./_area/ExamCollection.area";
export default function ExamsScreen() {
  return (
    <Shell>
      <ExamsStoreProvider>
        <ExamsHandler>
          <ExamHeaderArea />
          <ExamCollectionArea />
        </ExamsHandler>
      </ExamsStoreProvider>
    </Shell>
  );
}
