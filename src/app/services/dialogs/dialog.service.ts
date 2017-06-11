import { Injectable } from '@angular/core';
import {
  MdDialog,
  MdDialogConfig,
} from '@angular/material';
import {
  ConfirmDialogComponent,
  DemoDialogComponent,
} from 'app/components/dialogs';
import { DemoInfo } from 'app/scripts/demos';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class DialogService {

  constructor(private readonly dialog: MdDialog) { }

  confirm(title: string, message: string): Observable<boolean> {
    const config = new MdDialogConfig();
    config.data = { title, message };
    return this.dialog.open(ConfirmDialogComponent, config).afterClosed();
  }

  pickDemo(): Observable<DemoInfo> {
    return this.dialog.open(DemoDialogComponent, new MdDialogConfig()).afterClosed();
  }
}
