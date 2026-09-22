export function SessionStepsArea() {
  return (
    <section className="login-steps" id="how-it-works" aria-label="이용 방법">
      <ol className="login-step-grid">
        {[
          { title: "문제 등록", text: "이미지 · PDF · 한글 파일을 올려요." },
          { title: "문제 선택", text: "필요한 문제를 고르고 순서를 정해요." },
          { title: "시험지 출력", text: "시험지를 저장하고 언제든 출력해요." },
        ].map(({ title, text }, i) => (
          <li key={title}>
            <span className="login-step-number" aria-hidden="true">
              0{i + 1}
            </span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
