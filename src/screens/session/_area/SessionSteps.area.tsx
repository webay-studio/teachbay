import { Files, Layers, Printer } from "lucide-react";
export function SessionStepsArea() {
  return (
    <section
      className="landing-steps scroll-mt-[30px] pt-[95px] pb-[90px] text-center max-[600px]:px-2 max-[600px]:py-[65px]"
      id="how-it-works"
    >
      <div className="eyebrow">A SIMPLE WAY TO PREPARE</div>
      <h2>수업 준비, 세 단계면 충분해요.</h2>
      <div className="step-grid mx-[30px] mt-[50px] grid grid-cols-3 gap-16 text-left max-[900px]:mx-0 max-[900px]:gap-[25px] max-[600px]:mt-[35px] max-[600px]:grid-cols-1 max-[600px]:gap-8">
        {[
          {
            Icon: Files,
            title: "문제를 모으고",
            text: "이미지나 PDF, 한글 문서를 올려 필요한 문제를 모아두세요.",
          },
          {
            Icon: Layers,
            title: "내 수업에 맞게 고르고",
            text: "원하는 문제를 선택하고 순서와 구성을 자유롭게 정하세요.",
          },
          {
            Icon: Printer,
            title: "시험지로 완성해요",
            text: "완성된 시험지는 저장하고, 필요한 순간 다시 출력하세요.",
          },
        ].map(({ Icon, title, text }, i) => (
          <div key={title}>
            <span className="step-icon inline-flex rounded-[14px] bg-[#e9f0ff] p-3.5 text-brand">
              <Icon size={23} />
            </span>
            <small>0{i + 1}</small>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
