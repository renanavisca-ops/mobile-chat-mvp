import Link from 'next/link';
import { LegalDoc } from '@/components/legal/legal-doc';
import { LEGAL } from '@/lib/legal';

export const metadata = { title: 'Community Guidelines — Toky Chat' };

const mail = (
  <a className="text-blue-400 hover:text-blue-300" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
);

function En() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Community Guidelines</h1>
      <p className="mt-1 text-xs text-slate-500">Effective date: {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>Toky Chat is a place to talk with people you choose. To keep it safe for everyone, these guidelines apply to all content and behavior on the Service. They are part of our{' '}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</Link>. Breaking them can lead to content removal, or suspension or termination of your account.</p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Treat others with respect, even in disagreement.</li>
            <li>Share only content you have the right to share.</li>
            <li>Use the report and block tools if someone crosses a line.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Don&apos;t</h2>
          <p>There is <b>zero tolerance</b> for content that sexually exploits or endangers minors (CSAM). We remove it and report it to the authorities as required by law. Beyond that, do not:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>harass, bully, threaten, stalk, or intimidate anyone;</li>
            <li>post hateful content or incite violence against people based on who they are;</li>
            <li>share sexual or intimate images of anyone without their consent;</li>
            <li>promote self-harm, terrorism, or serious violence;</li>
            <li>sell or facilitate clearly illegal goods or services;</li>
            <li>impersonate others or deliberately deceive to cause harm;</li>
            <li>send spam, scams, or unsolicited bulk messages;</li>
            <li>distribute malware or try to break into or overload the Service.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Reporting &amp; enforcement</h2>
          <p>You can <b>report</b> any message or user, and <b>block</b> anyone, from within the app. Reports reach us and we review them. Depending on severity we may remove content, warn, suspend, or permanently ban accounts, and we may preserve and share information with authorities where the law requires it. You can also email {mail}.</p>
        </section>
      </div>
    </>
  );
}

function Es() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Normas de la comunidad</h1>
      <p className="mt-1 text-xs text-slate-500">Fecha de vigencia: {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-9 text-sm leading-relaxed text-slate-300">
        <section>
          <p>Toky Chat es un lugar para hablar con las personas que tú elijas. Para mantenerlo seguro para todos, estas normas se aplican a todo el contenido y comportamiento en el Servicio. Forman parte de nuestros{' '}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">Términos del servicio</Link>. Incumplirlas puede llevar a la eliminación de contenido, o a la suspensión o cierre de tu cuenta.</p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Sí</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Trata a los demás con respeto, aun cuando no estés de acuerdo.</li>
            <li>Comparte solo contenido que tengas derecho a compartir.</li>
            <li>Usa las herramientas de denuncia y bloqueo si alguien se pasa de la raya.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">No</h2>
          <p>Hay <b>tolerancia cero</b> con el contenido que explote sexualmente o ponga en peligro a menores. Lo eliminamos y lo reportamos a las autoridades según lo exige la ley. Además, no debes:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>acosar, intimidar, amenazar, hostigar o perseguir a nadie;</li>
            <li>publicar contenido de odio o incitar a la violencia contra personas por lo que son;</li>
            <li>compartir imágenes sexuales o íntimas de alguien sin su consentimiento;</li>
            <li>promover autolesiones, terrorismo o violencia grave;</li>
            <li>vender o facilitar bienes o servicios claramente ilegales;</li>
            <li>hacerte pasar por otras personas o engañar deliberadamente para causar daño;</li>
            <li>enviar spam, estafas o mensajes masivos no solicitados;</li>
            <li>distribuir software malicioso o intentar vulnerar o sobrecargar el Servicio.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Denuncias y aplicación</h2>
          <p>Puedes <b>denunciar</b> cualquier mensaje o usuario y <b>bloquear</b> a cualquiera desde la app. Las denuncias nos llegan y las revisamos. Según la gravedad, podemos eliminar contenido, advertir, suspender o cerrar cuentas de forma permanente, y podemos conservar y compartir información con las autoridades cuando la ley lo exija. También puedes escribir a {mail}.</p>
        </section>
      </div>
    </>
  );
}

export default function GuidelinesPage() {
  return <LegalDoc en={<En />} es={<Es />} />;
}
