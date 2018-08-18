import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';

@Component({
  selector: 'app-signout-dialog',
  templateUrl: './signout-dialog.component.html',
  styleUrls: ['./signout-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignoutDialogComponent {
  constructor(private readonly dialogRef: MatDialogRef<SignoutDialogComponent>) {}

  cancel() {
    this.dialogRef.close(false);
  }

  confirm() {
    this.dialogRef.close(true);
  }
}
