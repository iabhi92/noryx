import type { Problem, ProblemMetadata, EditorState, SubmissionEvent } from '../types';

export interface CodingPlatformAdapter {
  detect(): boolean;
  getProblem(): Promise<Problem | null>;
  getEditorState(): Promise<EditorState | null>;
  detectSubmission(): Promise<SubmissionEvent | null>;
  getProblemMetadata(): Promise<ProblemMetadata | null>;
}
