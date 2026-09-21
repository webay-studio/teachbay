"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Printer,
  Copy,
  Trash2,
  FileText,
  ArrowUpRight,
} from "lucide-react";
import { Shell, Heading, Empty, AssetImage } from "../../components/shared";
import { all, put, remove, errorText } from "../../lib/db";
import { Exam } from "../../lib/types";
export default function Exams() {
  const [rows, setRows] = useState<Exam[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const router = useRouter();
  async function refresh() {
    try {
      setRows(
        (await all("exams")).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <Shell>
      <Heading
        eyebrow="YOUR WORKSHEET COLLECTION"
        title="만든 시험지"
        description="한 번 준비한 시험지, 다음 수업에서도 꺼내 쓰세요."
      >
        <Link className="btn primary" href="/exams/new">
          <Plus size={17} />
          시험지 만들기
        </Link>
      </Heading>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="library-toolbar">
        <div className="tabs">
          <span>
            전체 시험지 <b>{rows.length}</b>
          </span>
        </div>
        <label className="search">
          <Search size={17} />
          <input
            placeholder="시험지 제목 검색"
            aria-label="시험지 제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="sort">최근 생성순</span>
      </div>
      {loading ? (
        <div className="empty">시험지를 불러오는 중…</div>
      ) : rows.length === 0 ? (
        <Empty
          title="아직 만든 시험지가 없어요"
          description="내 문제를 골라 첫 시험지를 만들어보세요."
          href="/exams/new"
          label="시험지 만들기"
        />
      ) : rows.filter((e) =>
          e.title.toLowerCase().includes(query.toLowerCase()),
        ).length === 0 ? (
        <div className="empty">
          <h2>검색 결과가 없어요.</h2>
          <button className="btn" onClick={() => setQuery("")}>
            검색 초기화
          </button>
        </div>
      ) : (
        <div className="exam-grid">
          {rows
            .filter((e) => e.title.toLowerCase().includes(query.toLowerCase()))
            .map((exam) => (
              <article className="exam-card" key={exam.id}>
                <Link
                  href={`/exams/${exam.id}`}
                  className="exam-thumbnail"
                  aria-label={`${exam.title} 미리보기`}
                >
                  <div className="mini-paper">
                    <h3>{exam.title}</h3>
                    <div className="mini-line" />
                    <div
                      className="mini-images"
                      style={{
                        gridTemplateColumns: `repeat(${exam.settings.columns},1fr)`,
                      }}
                    >
                      {exam.items.slice(0, 6).map((i) => (
                        <AssetImage key={i.id} id={i.assetId} alt={i.name} />
                      ))}
                    </div>
                  </div>
                  <span className="thumbnail-label">
                    <FileText size={13} />
                    {exam.pages}페이지
                  </span>
                </Link>
                <div className="exam-info">
                  <Link href={`/exams/${exam.id}`}>
                    <h2>
                      {exam.title}
                      <ArrowUpRight size={16} />
                    </h2>
                  </Link>
                  <p>
                    {new Date(exam.createdAt).toLocaleDateString("ko-KR")}
                    <i /> {exam.items.length}문항 · {exam.pages}페이지
                  </p>
                  <div className="exam-actions">
                    <Link className="btn" href={`/exams/${exam.id}?print=1`}>
                      <Printer size={15} />
                      다시 출력
                    </Link>
                    <button
                      className="text-btn"
                      onClick={async () => {
                        if (
                          !confirm(
                            "현재 작성 중인 내용을 이 시험지의 복사본으로 바꿀까요? 원본 시험지는 유지됩니다.",
                          )
                        )
                          return;
                        try {
                          await put("drafts", {
                            id: "current",
                            title: `${exam.title} (복사본)`,
                            items: structuredClone(exam.items),
                            settings: { ...exam.settings },
                          });
                          router.push("/exams/new");
                        } catch (e) {
                          setError(errorText(e));
                        }
                      }}
                    >
                      <Copy size={14} />
                      복사해서 수정
                    </button>
                    <button
                      className="icon"
                      aria-label={`${exam.title} 삭제`}
                      onClick={async () => {
                        if (
                          !confirm(
                            "저장한 시험지를 삭제할까요? 내 문제는 유지됩니다.",
                          )
                        )
                          return;
                        try {
                          await remove("exams", exam.id);
                          await refresh();
                        } catch (e) {
                          setError(errorText(e));
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}
    </Shell>
  );
}
