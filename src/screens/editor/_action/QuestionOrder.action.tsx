"use client";
import Link from "next/link";
import { Plus, ArrowUp, ArrowDown, Trash2, GripVertical } from "lucide-react";
import { AssetImage } from "@ui/shared";
import { useEditorHandler } from "../_handler/Editor.handler";
export function QuestionOrderAction() {
  const { value, update, drag, setDrag, move } = useEditorHandler();
  return (
    <>
      {" "}
      <aside className="question-order no-print">
        <div className="order-heading">
          <h2>
            선택한 문제 <span>{value.items.length}</span>
          </h2>
          <Link
            className="icon"
            aria-label="내 문제에서 추가"
            href="/questions"
          >
            <Plus size={19} />
          </Link>
        </div>
        <p>드래그하거나 화살표로 순서를 바꾸세요.</p>
        {value.items.map((item, i) => (
          <div
            key={item.id}
            className="order-card"
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (drag !== undefined) move(drag, i);
              setDrag(undefined);
            }}
          >
            <div className="order-card-top">
              <GripVertical size={14} />
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{item.name}</span>
              <button
                className="icon"
                aria-label={`${item.name} 시험지에서 제외`}
                onClick={() =>
                  update({
                    ...value,
                    items: value.items.filter((_, n) => n !== i),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
            <AssetImage id={item.assetId} alt={item.name} />
            <div className="order-buttons">
              <button
                className="icon"
                disabled={i === 0}
                aria-label={`${item.name} 위로 이동`}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon"
                disabled={i === value.items.length - 1}
                aria-label={`${item.name} 아래로 이동`}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>
        ))}
        <Link href="/questions" className="btn add-question">
          <Plus size={16} />내 문제에서 가져오기
        </Link>
      </aside>
    </>
  );
}
