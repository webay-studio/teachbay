"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ArrowRight,
  Check,
  Ellipsis,
  Expand,
  SlidersHorizontal,
} from "lucide-react";
import {
  Shell,
  Heading,
  AssetImage,
  Modal,
  Empty,
} from "../../components/shared";
import { all, put, remove, draft, errorText } from "../../lib/db";
import { snapshotQuestion } from "../../lib/reuse";
import { Question } from "../../lib/types";
export default function Questions() {
  const [rows, setRows] = useState<Question[]>([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [zoom, setZoom] = useState<Question>(),
    [edit, setEdit] = useState<Question>(),
    [menu, setMenu] = useState<string>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function refresh() {
    try {
      setRows(
        (await all("questions")).sort((a, b) =>
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
  const filtered = rows.filter((q) =>
    [q.name, q.filename, q.memo]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function make() {
    setBusy(true);
    try {
      const d = await draft();
      const ids = new Set(d.items.map((q) => q.id));
      const documents = await all("documents");
      d.items.push(
        ...rows
          .filter((q) => selected.includes(q.id) && !ids.has(q.id))
          .map((q) => snapshotQuestion(q, documents, rows)),
      );
      await put("drafts", d);
      router.push("/exams/new");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <Shell>
      <Heading
        eyebrow="MY QUESTION LIBRARY"
        title="내 문제"
        description="좋은 문제를 모아두고, 필요한 순간 시험지로 만들어보세요."
      >
        <Link href="/questions/new" className="btn primary">
          <Plus size={18} />
          문제 등록
        </Link>
      </Heading>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="library-toolbar">
        <div className="tabs">
          <span>
            전체 문제 <b>{rows.length}</b>
          </span>
        </div>
        <div className="toolbar-right">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="문제 검색"
              placeholder="문제 이름, 파일명, 메모 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="sort">
            <SlidersHorizontal size={15} />
            최근 등록순
          </span>
        </div>
      </div>
      {loading ? (
        <div className="empty">문제를 불러오는 중…</div>
      ) : rows.length === 0 ? (
        <Empty
          title="아직 등록한 문제가 없어요."
          description="문제 이미지를 올려 첫 시험지를 만들어보세요."
          href="/questions/new"
          label="문제 등록"
        />
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Search size={28} />
          <h2>검색 결과가 없어요.</h2>
          <p>다른 문제 이름, 원본 파일명 또는 메모로 찾아보세요.</p>
          <button className="btn" onClick={() => setQuery("")}>
            검색 초기화
          </button>
        </div>
      ) : (
        <>
          <div className="list-summary">
            <label>
              <input
                type="checkbox"
                checked={
                  filtered.length > 0 &&
                  filtered.every((q) => selected.includes(q.id))
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? Array.from(
                          new Set([...selected, ...filtered.map((q) => q.id)]),
                        )
                      : selected.filter(
                          (id) => !filtered.some((q) => q.id === id),
                        ),
                  )
                }
              />
              현재 목록 전체 선택
            </label>
            <span>이미지를 누르면 크게 볼 수 있어요</span>
          </div>
          <div className="question-grid">
            {filtered.map((q) => (
              <article
                key={q.id}
                className={`question-card ${selected.includes(q.id) ? "selected" : ""}`}
              >
                <div className="card-image">
                  <button
                    className="image-open"
                    aria-label={`${q.name} 이미지 확대`}
                    onClick={() => setZoom(q)}
                  >
                    <AssetImage id={q.assetId} alt={q.name} />
                    <span className="expand">
                      <Expand size={16} />
                    </span>
                  </button>
                  <input
                    className="card-check"
                    type="checkbox"
                    aria-label={`${q.name} 선택`}
                    checked={selected.includes(q.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, q.id]
                          : selected.filter((id) => id !== q.id),
                      )
                    }
                  />
                </div>
                <div className="card-bottom">
                  <div>
                    <h3>{q.name}</h3>
                    <span>
                      {q.source?.kind === "passage"
                        ? "공통 지문"
                        : "이미지 문제"}{" "}
                      <i /> {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div className="card-menu">
                    <button
                      className="icon"
                      aria-label={`${q.name} 수정 및 삭제`}
                      onClick={() => setMenu(menu === q.id ? undefined : q.id)}
                    >
                      <Ellipsis size={19} />
                    </button>
                    {menu === q.id && (
                      <div className="dropdown">
                        <button
                          onClick={() => {
                            setEdit({ ...q });
                            setMenu(undefined);
                          }}
                        >
                          이름·메모 수정
                        </button>
                        <button
                          className="danger"
                          onClick={async () => {
                            if (
                              !confirm(
                                "이 문제를 삭제할까요? 저장한 시험지는 그대로 유지됩니다.",
                              )
                            )
                              return;
                            try {
                              await remove("questions", q.id);
                              setSelected(selected.filter((id) => id !== q.id));
                              setMenu(undefined);
                              await refresh();
                            } catch (e) {
                              setError(errorText(e));
                            }
                          }}
                        >
                          문제 삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="library-hint">
            <Check size={15} />
            문제를 선택하면 나만의 시험지를 만들 수 있어요.
          </div>
        </>
      )}
      {selected.length > 0 && (
        <div className="selection-bar">
          <span className="selection-count">{selected.length}</span>
          <strong>선택한 문제 {selected.length}개</strong>
          <button className="text-btn" onClick={() => setSelected([])}>
            선택 해제
          </button>
          <button className="btn primary" disabled={busy} onClick={make}>
            시험지 만들기
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {zoom && (
        <Modal title={zoom.name} onClose={() => setZoom(undefined)}>
          {(zoom.fragments?.length
            ? zoom.fragments.map((f) => f.assetId)
            : [zoom.assetId]
          ).map((id, i) => (
            <AssetImage
              key={id}
              id={id}
              alt={`${zoom.name} · ${i + 1}번째 영역`}
              className="full-image"
            />
          ))}
          {zoom.memo && <p>{zoom.memo}</p>}
        </Modal>
      )}
      {edit && (
        <Modal title="문제 수정" onClose={() => setEdit(undefined)}>
          <label className="field">
            문제 이름
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </label>
          <label className="field">
            메모
            <textarea
              value={edit.memo}
              onChange={(e) => setEdit({ ...edit, memo: e.target.value })}
            />
          </label>
          <button
            className="btn primary"
            disabled={!edit.name.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await put("questions", {
                  ...edit,
                  updatedAt: new Date().toISOString(),
                });
                setEdit(undefined);
                await refresh();
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            변경 저장
          </button>
        </Modal>
      )}
    </Shell>
  );
}
