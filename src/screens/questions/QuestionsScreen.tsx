import { Shell } from "@ui/shared";
import { QuestionsStoreProvider } from "./_state/useQuestionsStore";
import { QuestionsHandler } from "./_handler/Questions.handler";
import { QuestionHeaderArea } from "./_area/QuestionHeader.area";
import { QuestionCollectionArea } from "./_area/QuestionCollection.area";
import { QuestionSelectionAction } from "./_action/QuestionSelection.action";
import { QuestionDialogsAction } from "./_action/QuestionDialogs.action";
export default function QuestionsScreen() {
  return (
    <Shell mainClassName="questions-page p-0">
      <QuestionsStoreProvider>
        <QuestionsHandler>
          <QuestionHeaderArea />
          <QuestionCollectionArea />
          <QuestionSelectionAction />
          <QuestionDialogsAction />
        </QuestionsHandler>
      </QuestionsStoreProvider>
    </Shell>
  );
}
