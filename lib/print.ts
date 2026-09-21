export async function printExam() {
  await document.fonts.ready;
  const root = document.getElementById("print-document");
  if (!root || !root.querySelector(".paper"))
    throw new Error("출력할 시험지가 없습니다.");
  // Wait for React's Blob URL effects to mount all images, including the optional logo.
  if (root.querySelector("[data-image-pending]"))
    await new Promise<void>((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (!root.querySelector("[data-image-pending]")) {
          observer.disconnect();
          clearTimeout(deadline);
          resolve();
        }
      });
      const deadline = window.setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            "이미지 준비가 지연되고 있습니다. 잠시 후 다시 출력해주세요.",
          ),
        );
      }, 15000);
      observer.observe(root, { childList: true, subtree: true });
    });
  const boxes = root.querySelectorAll(".print-image-box");
  if (Array.from(boxes).some((b) => !b.querySelector("img")))
    throw new Error("이미지를 준비하고 있습니다. 잠시 후 다시 출력해주세요.");
  try {
    await Promise.all(
      Array.from(root.querySelectorAll("img")).map((img) => img.decode()),
    );
  } catch {
    throw new Error(
      "출력할 이미지를 읽지 못했습니다. 시험지를 다시 열어주세요.",
    );
  }
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  window.print();
}
