import { Heading } from "@ui/shared";
import { SaveExamAction } from "../_action/SaveExam.action";
export function EditorHeaderArea() {
  return (
    <Heading
      eyebrow="YOUR NEXT CLASS, READY"
      title="시험지 만들기"
      description="완성된 모습을 보며, 다음 수업을 준비하세요."
    >
      <SaveExamAction />
    </Heading>
  );
}
