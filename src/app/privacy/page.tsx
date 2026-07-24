import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Privacy Policy — Toky Chat' };

const H2 = 'mb-3 text-lg font-semibold text-slate-100';
const H3 = 'mb-1 mt-4 font-semibold text-slate-200';
const UL = 'list-disc space-y-1 pl-5';
const mail = LEGAL.privacyEmail;

function En() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-500">Effective date: {LEGAL.effectiveDate} · Last updated: {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>This Privacy Policy describes how {LEGAL.operator} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) — an independent app operated by its individual creators based in {LEGAL.country} — collects, uses, discloses, and safeguards your information when you use our messaging application and related services (the &quot;Service&quot;). If you do not agree with this Policy, please do not use the Service.</p>
        </section>
        <section>
          <h2 className={H2}>1. Information we collect</h2>
          <h3 className={H3}>a. Information you provide</h3>
          <ul className={UL}>
            <li><b>Account information:</b> your email address and authentication credentials (passwords are handled by our authentication provider, not stored by us in plaintext).</li>
            <li><b>Profile information:</b> username, display name, and profile photo.</li>
            <li><b>Content you share:</b> the messages, images, videos, and voice notes you send or receive.</li>
            <li><b>Relationships:</b> your contacts and the chats and groups you belong to.</li>
            <li><b>Communications with us:</b> support requests, reports, or feedback.</li>
          </ul>
          <h3 className={H3}>b. Information collected automatically</h3>
          <ul className={UL}>
            <li><b>Device &amp; connection data:</b> IP address, device identifiers, and language settings.</li>
            <li><b>Usage &amp; log data:</b> actions taken, timestamps, delivery/read status, presence, and diagnostic logs.</li>
            <li><b>Local storage:</b> data stored on your device (session tokens, preferences, your consent choice) to keep you signed in.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>2. How we use information</h2>
          <ul className={UL}>
            <li>Provide and operate the Service — deliver messages and calls, show presence, enable groups and profiles.</li>
            <li>Authenticate you and keep your account secure.</li>
            <li>Detect and respond to abuse, spam, and safety issues (handling reports and blocks).</li>
            <li>Provide support and maintain, debug, and improve the Service.</li>
            <li>Comply with legal obligations and enforce our Terms.</li>
          </ul>
          <p className="mt-2">We do not use your messages for advertising, and we <b>do not sell your personal information</b>.</p>
        </section>
        <section>
          <h2 className={H2}>3. How we share information</h2>
          <ul className={UL}>
            <li><b>With other users:</b> your profile and the content you send are visible to the participants of your chats.</li>
            <li><b>With service providers (processors):</b> Supabase (database, authentication, storage, realtime), Vercel (hosting), Google Firebase Cloud Messaging (push notifications), and Cloudflare (STUN/TURN for calls). They process data on our behalf under security obligations.</li>
            <li><b>For legal reasons &amp; safety:</b> to comply with law or protect the rights and safety of our users and the public.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>4. Data retention</h2>
          <ul className={UL}>
            <li><b>Account &amp; profile:</b> kept until you delete your account, then removed right away; residual copies in backups are purged within {LEGAL.retentionDays} days.</li>
            <li><b>Messages &amp; media:</b> kept until deleted by participants. When you delete your account, messages you sent remain visible to the other participants but are <b>anonymized</b> — shown as coming from a deleted user. Backups purged within {LEGAL.retentionDays} days.</li>
            <li><b>Logs &amp; diagnostics:</b> up to {LEGAL.retentionDays} days.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>5. Security &amp; encryption</h2>
          <p>We protect your information with encryption in transit (HTTPS) and database-level access controls that restrict messages and media to the participants of a chat.</p>
          <p className="mt-2"><b>End-to-end encryption.</b> In direct (one-to-one) chats, the text and details of your messages are end-to-end encrypted by default: keys are generated on your device and we store only public keys and ciphertext, so we cannot read that content. <b>Media attachments</b> (images, videos, files) are stored on our servers with access controls but are <b>not yet</b> end-to-end encrypted. Group chats and channels are not end-to-end encrypted. If you lose your device and have not saved a passphrase backup of your key, your encrypted history may be unrecoverable.</p>
        </section>
        <section>
          <h2 className={H2}>6. Your rights &amp; choices</h2>
          <p>Depending on where you live, you may have rights to access, correct, delete, or export your data, to object to or restrict processing, and to withdraw consent. You can edit your profile and delete your account in the app, or contact us at <a className="text-blue-400 hover:text-blue-300" href={`mailto:${mail}`}>{mail}</a>. See our <Link href="/delete-account" className="text-blue-400 hover:text-blue-300">account &amp; data deletion</Link> page.</p>
        </section>
        <section>
          <h2 className={H2}>7. Children&apos;s privacy</h2>
          <p>The Service is not directed to children under {LEGAL.minAge}. If we learn we have collected personal information from a child under the applicable minimum age without proper consent, we will delete it.</p>
        </section>
        <section>
          <h2 className={H2}>8. Changes &amp; contact</h2>
          <p>We may update this Policy; material changes will be notified in the Service. Questions? Contact {LEGAL.operator} at <a className="text-blue-400 hover:text-blue-300" href={`mailto:${mail}`}>{mail}</a>.</p>
        </section>
      </div>
    </>
  );
}

function Es() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="mt-1 text-xs text-slate-500">Fecha de vigencia: {LEGAL.effectiveDate} · Última actualización: {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>Esta Política de privacidad describe cómo {LEGAL.operator} (&quot;nosotros&quot;) — una app independiente operada por sus creadores, con base en {LEGAL.country} — recopila, usa, divulga y protege tu información cuando usas nuestra aplicación de mensajería y servicios relacionados (el &quot;Servicio&quot;). Si no estás de acuerdo con esta Política, no uses el Servicio.</p>
        </section>
        <section>
          <h2 className={H2}>1. Información que recopilamos</h2>
          <h3 className={H3}>a. Información que nos proporcionas</h3>
          <ul className={UL}>
            <li><b>Datos de la cuenta:</b> tu correo electrónico y credenciales de acceso (las contraseñas las gestiona nuestro proveedor de autenticación, no las guardamos en texto plano).</li>
            <li><b>Datos del perfil:</b> nombre de usuario, nombre visible y foto de perfil.</li>
            <li><b>Contenido que compartes:</b> los mensajes, imágenes, videos y notas de voz que envías o recibes.</li>
            <li><b>Relaciones:</b> tus contactos y los chats y grupos a los que perteneces.</li>
            <li><b>Comunicaciones con nosotros:</b> solicitudes de soporte, denuncias o comentarios.</li>
          </ul>
          <h3 className={H3}>b. Información recopilada automáticamente</h3>
          <ul className={UL}>
            <li><b>Datos del dispositivo y conexión:</b> dirección IP, identificadores del dispositivo e idioma.</li>
            <li><b>Datos de uso y registro:</b> acciones realizadas, marcas de tiempo, estado de entrega/lectura, presencia y registros de diagnóstico.</li>
            <li><b>Almacenamiento local:</b> datos guardados en tu dispositivo (tokens de sesión, preferencias, tu elección de consentimiento) para mantener la sesión.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>2. Cómo usamos la información</h2>
          <ul className={UL}>
            <li>Prestar y operar el Servicio: entregar mensajes y llamadas, mostrar presencia, habilitar grupos y perfiles.</li>
            <li>Autenticarte y mantener tu cuenta segura.</li>
            <li>Detectar y responder a abusos, spam y problemas de seguridad (gestionar denuncias y bloqueos).</li>
            <li>Brindar soporte y mantener, depurar y mejorar el Servicio.</li>
            <li>Cumplir obligaciones legales y hacer valer nuestros Términos.</li>
          </ul>
          <p className="mt-2">No usamos tus mensajes para publicidad y <b>no vendemos tu información personal</b>.</p>
        </section>
        <section>
          <h2 className={H2}>3. Cómo compartimos la información</h2>
          <ul className={UL}>
            <li><b>Con otros usuarios:</b> tu perfil y el contenido que envías son visibles para los participantes de tus chats.</li>
            <li><b>Con proveedores de servicios (encargados):</b> Supabase (base de datos, autenticación, almacenamiento, tiempo real), Vercel (alojamiento), Google Firebase Cloud Messaging (notificaciones push) y Cloudflare (servidores STUN/TURN para llamadas). Procesan datos por cuenta nuestra bajo obligaciones de seguridad.</li>
            <li><b>Por motivos legales y de seguridad:</b> para cumplir la ley o proteger los derechos y la seguridad de nuestros usuarios y del público.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>4. Conservación de datos</h2>
          <ul className={UL}>
            <li><b>Cuenta y perfil:</b> se conservan hasta que elimines tu cuenta; luego se eliminan de inmediato y las copias residuales en respaldos se purgan en un máximo de {LEGAL.retentionDays} días.</li>
            <li><b>Mensajes y multimedia:</b> se conservan hasta que los participantes los eliminen. Al eliminar tu cuenta, los mensajes que enviaste siguen visibles para los demás participantes pero se <b>anonimizan</b>, mostrándose como de un usuario eliminado. Los respaldos se purgan en un máximo de {LEGAL.retentionDays} días.</li>
            <li><b>Registros y diagnósticos:</b> hasta {LEGAL.retentionDays} días.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>5. Seguridad y cifrado</h2>
          <p>Protegemos tu información con cifrado en tránsito (HTTPS) y controles de acceso a nivel de base de datos que limitan los mensajes y multimedia a los participantes de un chat.</p>
          <p className="mt-2"><b>Cifrado de extremo a extremo.</b> En los chats directos (uno a uno), el texto y los detalles de tus mensajes están cifrados de extremo a extremo de forma predeterminada: las claves se generan en tu dispositivo y solo guardamos claves públicas y texto cifrado, por lo que no podemos leer ese contenido. Los <b>archivos adjuntos</b> (imágenes, videos, archivos) se almacenan en nuestros servidores con controles de acceso, pero <b>aún no</b> están cifrados de extremo a extremo. Los chats de grupo y canales no están cifrados de extremo a extremo. Si pierdes tu dispositivo y no guardaste una copia de tu clave con frase de contraseña, tu historial cifrado podría ser irrecuperable.</p>
        </section>
        <section>
          <h2 className={H2}>6. Tus derechos y opciones</h2>
          <p>Según dónde vivas, puedes tener derecho a acceder, corregir, eliminar o exportar tus datos, a oponerte o limitar su tratamiento y a retirar tu consentimiento. Puedes editar tu perfil y eliminar tu cuenta en la app, o escribirnos a <a className="text-blue-400 hover:text-blue-300" href={`mailto:${mail}`}>{mail}</a>. Consulta la página de <Link href="/delete-account" className="text-blue-400 hover:text-blue-300">eliminación de cuenta y datos</Link>.</p>
        </section>
        <section>
          <h2 className={H2}>7. Privacidad de menores</h2>
          <p>El Servicio no está dirigido a menores de {LEGAL.minAge} años. Si nos enteramos de que recopilamos datos personales de un menor por debajo de la edad mínima aplicable sin el consentimiento adecuado, los eliminaremos.</p>
        </section>
        <section>
          <h2 className={H2}>8. Cambios y contacto</h2>
          <p>Podemos actualizar esta Política; los cambios importantes se notificarán en el Servicio. ¿Dudas? Contacta a {LEGAL.operator} en <a className="text-blue-400 hover:text-blue-300" href={`mailto:${mail}`}>{mail}</a>.</p>
        </section>
      </div>
    </>
  );
}

export default function PrivacyPage() {
  return <LegalDoc en={<En />} es={<Es />} />;
}
