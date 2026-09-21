"use client";
import { Cropper } from "@ui/cropper";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function QuestionCropAction() {
  const { crop, rows, setCrop, setRows } = useRegistrationHandler();
  return (
    <>
      {" "}
      {crop && rows.find((r) => r.id === crop) && (
        <Cropper
          asset={rows.find((r) => r.id === crop)!.asset}
          onClose={() => setCrop(undefined)}
          onSave={(asset) => {
            setRows(rows.map((r) => (r.id === crop ? { ...r, asset } : r)));
            setCrop(undefined);
          }}
        />
      )}
    </>
  );
}
