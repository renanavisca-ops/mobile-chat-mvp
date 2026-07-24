import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Delete Your Account & Data — Toky Chat' };

const mail = (
  <a className="text-blue-400 hover:text-blue-300" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
);

function En() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Delete Your Account &amp; Data</h1>
      <p className="mt-1 text-xs text-slate-500">How to permanently delete your Toky Chat account and associated data.</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Delete from inside the app</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <b>Settings</b>.</li>
            <li>Scroll to <b>Delete account</b>.</li>
            <li>Confirm. Your account and personal data are removed right away; residual copies in encrypted backups are purged within {LEGAL.retentionDays} days.</li>
          </ol>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Request deletion by email</h2>
          <p>If you can&apos;t sign in, email {mail} from the address on your account and ask us to delete it. We&apos;ll verify the request and complete it, typically within 30 days.</p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">What gets deleted</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile (username, display name, avatar).</li>
            <li>Your devices, contacts, chat memberships, blocks, and encryption keys.</li>
            <li>Push-notification tokens for your devices, and your uploaded files (avatars, stories, wallpapers).</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">What may remain</h2>
          <p>Messages you already sent stay visible to the people you sent them to, so deleting your account doesn&apos;t erase other people&apos;s history — but they are <b>anonymized</b> and shown as coming from a deleted user. Copies in encrypted backups are purged within {LEGAL.retentionDays} days. See our{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link> for details.</p>
        </section>
      </div>
    </>
  );
}

function Es() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Eliminar tu cuenta y datos</h1>
      <p className="mt-1 text-xs text-slate-500">Cómo eliminar de forma permanente tu cuenta de Toky Chat y los datos asociados.</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Eliminar desde la app</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Abre <b>Ajustes</b>.</li>
            <li>Baja hasta <b>Eliminar cuenta</b>.</li>
            <li>Confirma. Tu cuenta y tus datos personales se eliminan de inmediato; las copias residuales en respaldos cifrados se purgan en un máximo de {LEGAL.retentionDays} días.</li>
          </ol>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Solicitar la eliminación por correo</h2>
          <p>Si no puedes iniciar sesión, escribe a {mail} desde el correo de tu cuenta y pídenos eliminarla. Verificaremos la solicitud y la completaremos, normalmente en un máximo de 30 días.</p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Qué se elimina</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Tu perfil (nombre de usuario, nombre visible, avatar).</li>
            <li>Tus dispositivos, contactos, membresías de chats, bloqueos y claves de cifrado.</li>
            <li>Los tokens de notificaciones de tus dispositivos y los archivos que subiste (avatares, historias, fondos).</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Qué puede permanecer</h2>
          <p>Los mensajes que ya enviaste seguirán visibles para quienes los recibieron, para no borrar el historial de otras personas — pero se <b>anonimizan</b> y aparecen como de un usuario eliminado. Las copias en respaldos cifrados se purgan en un máximo de {LEGAL.retentionDays} días. Consulta nuestra{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Política de privacidad</Link> para más detalles.</p>
        </section>
      </div>
    </>
  );
}

export default function DeleteAccountPage() {
  return <LegalDoc en={<En />} es={<Es />} />;
}
