import { ArrowUpRight } from "lucide-react";
import { Brand } from "@ui/shared";
import { StartSessionAction } from "../_action/StartSession.action";
export function SessionHeaderArea() {
  return (
    <header className="studio-header mx-auto flex min-h-24 max-w-[1320px] items-center  gap-8 px-11 py-6 max-[900px]:gap-5 max-[900px]:px-[26px] max-[900px]:py-[22px] max-[600px]:min-h-[82px] max-[600px]:flex-wrap max-[600px]:gap-4 max-[600px]:p-5">
      <Brand />
      <a className="login-how" href="#how-it-works">
        이용 방법
      </a>
      <StartSessionAction className="btn login-header-start">
        내 작업실 열기 <ArrowUpRight size={16} />
      </StartSessionAction>
    </header>
  );
}
