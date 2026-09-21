import {
  Exam,
  ExamDraft,
  ImageAsset,
  Question,
  StoredDocument,
  emptyDraft,
} from "./types";
type Stores = {
  documents: StoredDocument;
  questions: Question;
  assets: ImageAsset;
  exams: Exam;
  drafts: ExamDraft;
};
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("teachway", 2);
    let blocked = false;
    r.onblocked = () => {
      blocked = true;
      connection = undefined;
      reject(
        new Error(
          "저장소를 업데이트하려면 이 서비스의 다른 탭을 닫고 새로고침해주세요.",
        ),
      );
    };
    r.onupgradeneeded = () => {
      for (const name of [
        "questions",
        "assets",
        "exams",
        "drafts",
        "documents",
      ])
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, { keyPath: "id" });
    };
    r.onsuccess = () => {
      if (blocked) {
        r.result.close();
        return;
      }
      r.result.onversionchange = () => {
        r.result.close();
        connection = undefined;
      };
      resolve(r.result);
    };
    r.onerror = () => {
      connection = undefined;
      reject(r.error);
    };
  }));
}
export async function all<K extends keyof Stores>(
  store: K,
): Promise<Stores[K][]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function get<K extends keyof Stores>(
  store: K,
  id: string,
): Promise<Stores[K] | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function put<K extends keyof Stores>(store: K, value: Stores[K]) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    t.objectStore(store).put(value);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export async function remove(store: "questions" | "exams", id: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    t.objectStore(store).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function saveQuestions(
  rows: {
    question: Question;
    asset: ImageAsset;
    extraAssets?: ImageAsset[];
    document?: StoredDocument;
  }[],
) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction(["questions", "assets", "documents"], "readwrite");
    const storedAssets = new Set<string>(),
      storedDocuments = new Set<string>();
    const storeAsset = (a: ImageAsset) => {
      if (!storedAssets.has(a.id)) {
        t.objectStore("assets").put(a);
        storedAssets.add(a.id);
      }
    };
    rows.forEach(({ question, asset, extraAssets, document }) => {
      extraAssets?.forEach(storeAsset);
      if (document && !storedDocuments.has(document.id)) {
        t.objectStore("documents").put(document);
        storedDocuments.add(document.id);
      }
      t.objectStore("questions").put(question);
      storeAsset(asset);
    });
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export const draft = async () =>
  (await get("drafts", "current")) ?? emptyDraft();
export const errorText = (e: unknown) =>
  e instanceof DOMException && e.name === "QuotaExceededError"
    ? "브라우저 저장 공간이 부족합니다. 불필요한 자료를 정리한 뒤 다시 시도해주세요."
    : e instanceof Error && e.message.includes("다른 탭")
      ? e.message
      : "자료를 처리하지 못했습니다. 브라우저 저장소 설정을 확인하고 다시 시도해주세요.";
