import type { Question } from "@engine/types";
export interface QuestionsState {
  rows: Question[];
  setRows: (value: Question[] | ((previous: Question[]) => Question[])) => void;
  loading: boolean;
  setLoading: (value: boolean | ((previous: boolean) => boolean)) => void;
  query: string;
  setQuery: (value: string | ((previous: string) => string)) => void;
  selected: string[];
  setSelected: (value: string[] | ((previous: string[]) => string[])) => void;
  zoom: Question | undefined;
  setZoom: (
    value:
      | Question
      | undefined
      | ((previous: Question | undefined) => Question | undefined),
  ) => void;
  edit: Question | undefined;
  setEdit: (
    value:
      | Question
      | undefined
      | ((previous: Question | undefined) => Question | undefined),
  ) => void;
  menu: string | undefined;
  setMenu: (
    value:
      | string
      | undefined
      | ((previous: string | undefined) => string | undefined),
  ) => void;
  error: string;
  setError: (value: string | ((previous: string) => string)) => void;
  busy: boolean;
  setBusy: (value: boolean | ((previous: boolean) => boolean)) => void;
}
