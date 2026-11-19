import { Routes } from '@angular/router';
import { Listado } from './listado';
import { Detalle } from './detalle';
import { Formulario } from './formulario';
import { Chatbot } from './chatbot';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'libros' },
  { path: 'libros', component: Listado, data: { esLibro: true }, title: 'Libros · Biblioteca' },
  { path: 'libros/nuevo', component: Formulario, data: { esLibro: true }, title: 'Nuevo libro · Biblioteca' },
  { path: 'libros/:id/editar', component: Formulario, data: { esLibro: true }, title: 'Editar libro · Biblioteca' },
  { path: 'libros/:id', component: Detalle, data: { esLibro: true }, title: 'Detalle del libro · Biblioteca' },
  { path: 'autores', component: Listado, title: 'Autores · Biblioteca' },
  { path: 'autores/nuevo', component: Formulario, title: 'Nuevo autor · Biblioteca' },
  { path: 'autores/:id/editar', component: Formulario, title: 'Editar autor · Biblioteca' },
  { path: 'autores/:id', component: Detalle, title: 'Detalle del autor · Biblioteca' },
  { path: 'chatbot', component: Chatbot, title: 'Chatbot · Biblioteca' },
  { path: '**', redirectTo: 'libros' },
];
