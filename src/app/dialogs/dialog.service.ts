import { Observable } from 'rxjs/Rx';
import { ConfirmDialogComponent, DemoDialogComponent } from '.';
import { MdDialog, MdDialogConfig } from '@angular/material';
import { Injectable, ViewContainerRef } from '@angular/core';

@Injectable()
export class DialogService {

  constructor(private dialog: MdDialog) { }

  confirm(
    viewContainerRef: ViewContainerRef,
    title: string,
    message: string): Observable<boolean> {

    const config = new MdDialogConfig();
    config.viewContainerRef = viewContainerRef;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, config);
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;
    return dialogRef.afterClosed();
  }

  demo(viewContainerRef: ViewContainerRef, demoTitles: string[]): Observable<string> {
    const config = new MdDialogConfig();
    config.viewContainerRef = viewContainerRef;
    const dialogRef = this.dialog.open(DemoDialogComponent, config);
    dialogRef.componentInstance.demoTitles = demoTitles;
    return dialogRef.afterClosed();
  }
}
