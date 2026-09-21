"use client";
import { BookOpen, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/auth";
export default function Login() {
  const router = useRouter();
  return (
    <div className="login login-simple">
      <div className="login-card">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen />
          </span>
          teachbay.
        </div>
        <div className="eyebrow">LESS PREP, MORE TEACHING</div>
        <h1>
          내 문제를 모아,
          <br />
          바로 시험지로.
        </h1>
        <p>
          흩어져 있던 문제 이미지를 한곳에.
          <br />
          다음 수업의 시험지를 가볍게 준비하세요.
        </p>
        <div className="login-features">
          {[
            "이미지만 올리면 문제 등록 끝",
            "원하는 문제를 골라 나만의 시험지로",
            "저장하고, 필요할 때 다시 출력",
          ].map((t) => (
            <div key={t}>
              <Check size={17} />
              {t}
            </div>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={() => {
            auth.login();
            router.push("/questions");
          }}
        >
          시작하기
          <ArrowRight size={18} />
        </button>
        <small>
          회원가입 없이 이 기기에서 사용합니다.
          <br />
          현재 자료는 이 브라우저에 저장됩니다.
        </small>
      </div>
    </div>
  );
}
