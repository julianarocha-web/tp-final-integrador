import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter, RouteReuseStrategy, BaseRouteReuseStrategy, ActivatedRouteSnapshot } from '@angular/router';
import { routes } from './app.routes';

class ReutilizarRuta extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot) {
    return super.shouldReuseRoute(future, current) && future.params['id'] === current.params['id'];
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: RouteReuseStrategy, useClass: ReutilizarRuta },
  ],
};
