import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {RouterModule, Routes} from "@angular/router";
import {ThermalPrintModule} from 'ng-thermal-print';
import {AppComponent} from './app.component';
import {LandingLayoutComponent} from './layout/landing-layout/landing-layout.component';
import {HomeComponent} from './home/home.component';

const routes: Routes = [
  {path: '', redirectTo: 'home', pathMatch: 'full'},
  {
    path: '',
    component: LandingLayoutComponent,
    children: [
      {
        path: 'home',
        component: HomeComponent
      }
    ]
  },
  {path: '**', redirectTo: 'home'}
];

@NgModule({
  declarations: [
    AppComponent,
    LandingLayoutComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    ThermalPrintModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
