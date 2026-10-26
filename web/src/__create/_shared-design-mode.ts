export interface StyleInfo {
  className: string;
  styles: Record<string, string> | null;
}

export type GetStyleInfo = (resolved: { element: any }) => StyleInfo;

export function initDesignMode(getStyleInfo: GetStyleInfo): () => void {
  return () => {};
}
