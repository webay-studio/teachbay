import { ArrowUpRight, Check } from "lucide-react";
import { StartSessionAction } from "../_action/StartSession.action";
export function SessionHeroArea() {
  return (
    <section className="landing-hero py-[77px] pb-[72px] text-center max-[600px]:py-[50px]">
      <div className="eyebrow">LESS PREP. MORE POSSIBILITIES.</div>
      <h1>
        좋은 문제를 모아,
        <br />
        <span>나만의 수업으로.</span>
      </h1>
      <p>
        흩어진 문제는 한곳에, 수업 준비는 더 가볍게.
        <br />
        문제를 모으고 시험지를 만드는 당신의 작은 작업실.
      </p>
      <StartSessionAction className="btn primary">
        지금 시작하기 <ArrowUpRight size={18} />
      </StartSessionAction>
      <small>
        <Check size={13} /> 회원가입 없이, 이 브라우저에서 바로 시작
      </small>
    </section>
  );
}
