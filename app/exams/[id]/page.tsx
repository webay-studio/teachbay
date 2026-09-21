import ExamDetailScreen from "@/screens/examDetail/ExamDetailScreen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExamDetailScreen id={id} />;
}
