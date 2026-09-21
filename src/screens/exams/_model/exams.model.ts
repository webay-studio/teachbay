import type { Exam } from "@engine/types";
export interface ExamsState {
  rows: Exam[];
  setRows: (value: Exam[] | ((previous: Exam[]) => Exam[])) => void;
  query: string;
  setQuery: (value: string | ((previous: string) => string)) => void;
  error: string;
  setError: (value: string | ((previous: string) => string)) => void;
  loading: boolean;
  setLoading: (value: boolean | ((previous: boolean) => boolean)) => void;
  busy: boolean;
  setBusy: (value: boolean | ((previous: boolean) => boolean)) => void;
}
