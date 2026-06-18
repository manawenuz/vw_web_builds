import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { SmAdminComponent } from "./sm-admin.component";

const routes: Routes = [
  { path: "", component: SmAdminComponent },
  { path: ":orgId", component: SmAdminComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SmAdminRoutingModule {}
