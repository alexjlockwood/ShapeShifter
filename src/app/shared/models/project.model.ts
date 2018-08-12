/** A firestore project. */
export interface Project {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly content: string;
}
