import type { Metadata } from "next";
import localFont from "next/font/local";
import { RegistrationIntakeProvider } from "@/_state/RegistrationIntake";
import "./globals.css";
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap",
  preload: true,
});
export const metadata: Metadata = {
  title: "teachbay · teaching studio",
  description: "개인 강사를 위한 문제 보관함과 시험지 제작 도구",
};
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <RegistrationIntakeProvider>
          {children}
          {modal}
        </RegistrationIntakeProvider>
      </body>
    </html>
  );
}
