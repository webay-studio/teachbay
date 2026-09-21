import { neutralPixels, physicalRegions } from "./physical";
const scope = self as unknown as {
  onmessage: (
    event: MessageEvent<{
      data: Uint8ClampedArray;
      width: number;
      height: number;
    }>,
  ) => void;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};
scope.onmessage = ({ data: { data, width, height } }) => {
  try {
    const regions = physicalRegions(data, width, height),
      neutral = neutralPixels(data);
    scope.postMessage({ regions, neutral }, [neutral.buffer]);
  } catch (error) {
    scope.postMessage(
      { error: error instanceof Error ? error.message : "이미지 분석 실패" },
      [],
    );
  }
};
