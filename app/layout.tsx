import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "teachbay · teaching studio",
  description: "개인 강사를 위한 문제 보관함과 시험지 제작 도구",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
