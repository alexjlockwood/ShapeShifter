import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';

@Component({
  templateUrl: './signin-dialog.component.html',
  styleUrls: ['./signin-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SigninDialogComponent {
  constructor(private readonly dialogRef: MatDialogRef<SigninDialogComponent, boolean>) {}

  cancel() {
    this.dialogRef.close(false);
  }

  confirm() {
    this.dialogRef.close(true);
  }
}
