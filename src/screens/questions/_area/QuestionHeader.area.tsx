import Link from "next/link";
import { Plus } from "lucide-react";
import { Heading } from "@ui/shared";
export function QuestionHeaderArea() {
  return (
    <Heading
      title="좋은 문제, 차곡차곡."
      description="내 수업에 꼭 맞는 문제를 모아, 다음 수업의 가능성으로."
    >
      <Link href="/questions/new" scroll={false} className="btn primary">
        <Plus size={18} />
        문제 등록
      </Link>
    </Heading>
  );
}
