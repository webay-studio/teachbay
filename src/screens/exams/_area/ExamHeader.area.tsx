import Link from "next/link";
import { Plus } from "lucide-react";
import { Heading } from "@ui/shared";
export function ExamHeaderArea() {
  return (
    <Heading
      eyebrow="YOUR WORKSHEET COLLECTION"
      title="다시 꺼내보는, 좋은 수업."
      description="정성껏 준비한 시험지를 모아두고, 필요한 순간 다시 만나세요."
    >
      <Link href="/exams/new" className="btn primary">
        <Plus size={17} />
        시험지 만들기
      </Link>
    </Heading>
  );
}
