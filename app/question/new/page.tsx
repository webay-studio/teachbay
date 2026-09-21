import { redirect } from "next/navigation";
export default function NewQuestionRedirect() {
  redirect("/questions/new");
}
