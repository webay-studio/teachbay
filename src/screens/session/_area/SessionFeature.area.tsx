export function SessionFeatureArea() {
  return (
    <div className="login-paper-scene" aria-hidden="true">
      <div className="login-paper-sheet">
        <div className="login-paper-meta">
          <span>나의 수업 자료</span>
          <span>01</span>
        </div>
        <h2>오늘의 배움</h2>
        <div className="login-paper-fields">
          이름 <span /> 날짜 <span />
        </div>
        {[1, 2, 3].map((n) => (
          <div className="login-paper-item" key={n}>
            <b>0{n}</b>
            <div>
              <i />
              <i />
              <i />
              {n === 2 && <div className="login-answer-space" />}
            </div>
          </div>
        ))}
        <div className="login-paper-bottom">
          teachbay <span>1</span>
        </div>
      </div>
      <span className="login-paper-caption">
        내가 고른 문제로, 나만의 시험지.
      </span>
    </div>
  );
}
