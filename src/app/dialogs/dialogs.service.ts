import { Observable } from 'rxjs/Rx';
import { ConfirmDialogComponent } from './confirmdialog.component';
import { MdDialogRef, MdDialog, MdDialogConfig } from '@angular/material';
import { Injectable, ViewContainerRef } from '@angular/core';

@Injectable()
export class DialogsService {

  constructor(private dialog: MdDialog) { }

  public confirm(
    title: string,
    message: string,
    viewContainerRef: ViewContainerRef): Observable<boolean> {

    const config = new MdDialogConfig();
    config.viewContainerRef = viewContainerRef;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, config);
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;
    return dialogRef.afterClosed();
  }
}
