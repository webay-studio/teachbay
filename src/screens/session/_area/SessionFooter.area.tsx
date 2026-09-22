export function SessionFooterArea() {
  return (
    <footer className="studio-footer mx-auto mt-auto flex w-full max-w-[1232px] items-center justify-between gap-5 border-t border-line px-0 py-7 text-[#747f93] max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-3.5 max-[600px]:py-[23px]">
      <span className="inline-flex items-center">
        <img src="/teachbay-symbol.png" alt="teachbay" width={28} height={28} />
        <small>좋은 수업을 위한 작은 여유.</small>
      </span>
      <span>자료는 이 브라우저에 저장됩니다.</span>
    </footer>
  );
}
