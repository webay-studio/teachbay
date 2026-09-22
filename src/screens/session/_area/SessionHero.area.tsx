import { ArrowUpRight } from "lucide-react";
import { StartSessionAction } from "../_action/StartSession.action";
export function SessionHeroArea() {
  return (
    <section className="login-intro">
      <div className="login-intro-copy">
        <img
          className="login-intro-logo"
          src="/teachbay-symbol.png"
          alt="teachbay"
          width={44}
          height={44}
        />
        <span className="login-label">나의 수업 준비 공간</span>
        <h1>
          좋은 문제를 모아,
          <br />
          나만의 수업으로.
        </h1>
        <p>
          내 문제를 모아, 바로 시험지로.
          <br />
          필요한 문제만 골라 다음 수업을 준비하세요.
        </p>
        <StartSessionAction className="btn primary">
          내 작업실 시작하기 <ArrowUpRight size={17} />
        </StartSessionAction>
        <small>
          회원가입 없이 시작합니다. 자료는 이 브라우저에 저장됩니다.
        </small>
      </div>
    </section>
  );
}
