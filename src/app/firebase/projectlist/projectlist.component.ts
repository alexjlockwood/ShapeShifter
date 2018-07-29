import { Component, OnInit } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from 'angularfire2/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Project {
  readonly id: string;
  readonly name: string;
  readonly uid: string;
  readonly content: string;
}

@Component({
  selector: 'app-projectlist',
  templateUrl: './projectlist.component.html',
  styleUrls: ['./projectlist.component.scss'],
})
export class ProjectListComponent {
  private readonly projectsCollection: AngularFirestoreCollection<Project>;
  readonly projects: Observable<Project[]>;

  constructor(angularFirestore: AngularFirestore) {
    this.projectsCollection = angularFirestore.collection<Project>('projects');
    this.projects = this.projectsCollection.snapshotChanges().pipe(
      map(actions => {
        return actions.map(action => {
          const project = action.payload.doc.data() as Project;
          const id = action.payload.doc.id;
          return { id, ...project };
        });
      }),
    );
  }
}
