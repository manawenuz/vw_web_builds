import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { SmAdminRoutingModule } from "./sm-admin-routing.module";
import { SmAdminComponent } from "./sm-admin.component";

@NgModule({
  declarations: [SmAdminComponent],
  imports: [CommonModule, FormsModule, HttpClientModule, SmAdminRoutingModule],
})
export class SmAdminModule {}
