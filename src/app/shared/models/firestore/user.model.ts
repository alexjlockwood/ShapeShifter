/** A firestore user. */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly photoURL: string;
  readonly displayName: string;
}
