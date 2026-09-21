import { ArrowUpRight, Check } from "lucide-react";
import { StartSessionAction } from "../_action/StartSession.action";
export function SessionFeatureArea() {
  return (
    <section className="studio-feature">
      <div className="feature-copy relative z-2">
        <div className="eyebrow">A LITTLE SPACE FOR YOUR NEXT CLASS</div>
        <h2>
          준비는 간결하게.
          <br />
          수업은 당신답게.
        </h2>
        <p>
          차곡차곡 모아둔 좋은 문제들이
          <br />
          다음 수업의 새로운 가능성이 되도록.
        </p>
        <StartSessionAction className="feature-link">
          첫 문제 모으기 <ArrowUpRight size={18} />
        </StartSessionAction>
      </div>
      <div
        className="worksheet-art relative grid h-[340px] place-items-center max-[600px]:mt-[35px] max-[600px]:h-[330px]"
        aria-hidden="true"
      >
        <div className="art-orbit" />
        <div className="studio-paper back" />
        <div className="studio-paper front">
          <span>MADE FOR YOUR CLASS</span>
          <h3>
            새로운 배움의
            <br />
            시작.
          </h3>
          <div className="paper-rule" />
          <div className="art-question">
            <b>01</b>
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="art-question">
            <b>02</b>
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="art-paper-footer">YOUR NEXT CLASS, READY. ↗</span>
        </div>
        <div className="art-sticker">
          <Check size={15} /> Ready to teach
        </div>
      </div>
      <span className="feature-caption absolute bottom-5 left-[30px] text-[8px] tracking-[1.8px] text-[#99b7f7]">
        TEACHBAY — TEACHING EXPERIENCES
      </span>
    </section>
  );
}
