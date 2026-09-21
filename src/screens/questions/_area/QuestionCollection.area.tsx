import { QuestionSearchAction } from "../_action/QuestionSearch.action";
import { QuestionListAction } from "../_action/QuestionList.action";
export function QuestionCollectionArea() {
  return (
    <section className="min-w-0">
      <QuestionSearchAction />
      <QuestionListAction />
    </section>
  );
}
