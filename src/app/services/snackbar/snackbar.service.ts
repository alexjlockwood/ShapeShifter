import { Injectable } from '@angular/core';
import { MdSnackBar } from '@angular/material';

export enum Duration {
  Short = 2750,
  Long = 5000,
}

@Injectable()
export class SnackBarService {

  constructor(private readonly snackBar: MdSnackBar) { }

  show(message: string, action: string, duration: Duration) {
    this.snackBar.open(message, action, { duration });
  }
}
