import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Help & Support — Toky Chat' };

const mail = (
  <a className="text-blue-400 hover:text-blue-300" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
);

function En() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Help &amp; Support</h1>
      <p className="mt-1 text-xs text-slate-500">We&apos;re a small independent team and read every message.</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Contact us</h2>
          <p>Email {mail} for help, bug reports, privacy questions, or to report abuse. We aim to reply within a few business days; safety reports are handled as fast as we can.</p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Common tasks</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Block someone:</b> open the chat or their contact entry and choose <i>Block user</i>.</li>
            <li><b>Report a message or user:</b> press and hold a message (or open a contact) and choose <i>Report</i>.</li>
            <li><b>Mute a chat:</b> open the chat menu and toggle <i>Mute</i>.</li>
            <li><b>Encryption backup:</b> in <b>Settings → Encryption</b>, set a passphrase so you can read encrypted messages after reinstalling or on a new device.</li>
            <li><b>Delete your account:</b> see our <Link href="/delete-account" className="text-blue-400 hover:text-blue-300">account &amp; data deletion</Link> page.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Policies</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/guidelines" className="text-blue-400 hover:text-blue-300">Community Guidelines</Link>
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>
          </p>
        </section>
      </div>
    </>
  );
}

function Es() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Ayuda y soporte</h1>
      <p className="mt-1 text-xs text-slate-500">Somos un equipo independiente pequeño y leemos cada mensaje.</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Contáctanos</h2>
          <p>Escribe a {mail} para obtener ayuda, reportar errores, hacer consultas de privacidad o denunciar abusos. Respondemos en pocos días hábiles; las denuncias de seguridad se atienden lo más rápido posible.</p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Tareas frecuentes</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Bloquear a alguien:</b> abre el chat o su contacto y elige <i>Bloquear usuario</i>.</li>
            <li><b>Denunciar un mensaje o usuario:</b> mantén presionado un mensaje (o abre un contacto) y elige <i>Denunciar</i>.</li>
            <li><b>Silenciar un chat:</b> abre el menú del chat y activa <i>Silenciar</i>.</li>
            <li><b>Copia de tu clave:</b> en <b>Ajustes → Cifrado</b>, define una frase de contraseña para poder leer los mensajes cifrados tras reinstalar o en otro dispositivo.</li>
            <li><b>Eliminar tu cuenta:</b> consulta la página de <Link href="/delete-account" className="text-blue-400 hover:text-blue-300">eliminación de cuenta y datos</Link>.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Políticas</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/guidelines" className="text-blue-400 hover:text-blue-300">Normas de la comunidad</Link>
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Términos del servicio</Link>
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Política de privacidad</Link>
          </p>
        </section>
      </div>
    </>
  );
}

export default function SupportPage() {
  return <LegalDoc en={<En />} es={<Es />} />;
}
