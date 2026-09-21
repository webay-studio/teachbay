import { ExamSearchAction } from "../_action/ExamSearch.action";
import { ExamListAction } from "../_action/ExamList.action";
export function ExamCollectionArea() {
  return (
    <section className="min-w-0">
      <ExamSearchAction />
      <ExamListAction />
    </section>
  );
}
