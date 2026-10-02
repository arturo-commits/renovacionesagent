"use client";

import { useActionState } from "react";
import { register } from "../actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="form-row">
        <div className="field">
          <label htmlFor="first_name">Nombre *</label>
          <input className="input" id="first_name" name="first_name" required autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="last_name">Apellidos *</label>
          <input className="input" id="last_name" name="last_name" required autoComplete="family-name" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Email corporativo *</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="nif">NIF / NIE</label>
          <input className="input" id="nif" name="nif" placeholder="12345678Z" />
        </div>
        <div className="field">
          <label htmlFor="phone">Teléfono</label>
          <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="department">Departamento</label>
          <select className="input" id="department" name="department" defaultValue="">
            <option value="">—</option>
            <option>Atención al cliente</option>
            <option>Ventas</option>
            <option>Renovaciones</option>
            <option>Siniestros</option>
            <option>Operaciones</option>
            <option>Producto</option>
            <option>Tecnología</option>
            <option>Personas</option>
            <option>Otro</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="job_title">Puesto</label>
          <input className="input" id="job_title" name="job_title" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="company">Empresa</label>
        <input className="input" id="company" name="company" defaultValue="Tuio" />
        <span className="hint">Si eres colaborador externo o mediador, indica tu empresa.</span>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="password">Contraseña *</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="password2">Repite la contraseña *</label>
          <input className="input" id="password2" name="password2" type="password" minLength={8} required autoComplete="new-password" />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="consent" required />
        <span>Acepto que Tuio trate mis datos para gestionar mi formación y emitir los certificados correspondientes.</span>
      </label>
      <button className="btn block" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
