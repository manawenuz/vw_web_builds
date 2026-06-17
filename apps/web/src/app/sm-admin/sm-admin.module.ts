import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SmAdminRoutingModule } from './sm-admin-routing.module';
import { SmAdminComponent } from './sm-admin.component';

@NgModule({
  declarations: [SmAdminComponent],
  imports: [CommonModule, SmAdminRoutingModule],
})
export class SmAdminModule {}
