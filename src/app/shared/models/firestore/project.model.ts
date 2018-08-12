/** A firestore project. */
export interface Project {
  /** The project's unique ID. */
  readonly id: string;
  /** The ID of the user who owns this project. */
  readonly userId: string;
  /** The name of the project. */
  readonly name: string;
  /** The content of the project. */
  readonly content: string;
}
